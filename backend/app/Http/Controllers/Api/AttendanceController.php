<?php

namespace App\Http\Controllers\Api;

use App\Enums\AttendanceStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Election;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AttendanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'election_id' => ['nullable', 'integer', 'exists:elections,id'],
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:present,absent'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $query = User::query()
            ->where('role', UserRole::VOTER->value)
            ->orderBy('name');

        if (! empty($data['status'])) {
            $query->where('attendance_status', (string) $data['status']);
        }

        if (! empty($data['search'])) {
            $search = (string) $data['search'];
            $query->where(function ($builder) use ($search): void {
                $builder->where('name', 'like', '%'.$search.'%')
                    ->orWhere('voter_id', 'like', '%'.$search.'%')
                    ->orWhere('branch', 'like', '%'.$search.'%');
            });
        }

        $totalCount = (clone $query)->count();
        $presentCount = (clone $query)->where('attendance_status', AttendanceStatus::PRESENT->value)->count();
        $absentCount = (clone $query)->where('attendance_status', AttendanceStatus::ABSENT->value)->count();

        $electionId = isset($data['election_id']) ? (int) $data['election_id'] : null;
        $electionTitle = null;
        if ($electionId !== null) {
            $electionTitle = Election::query()
                ->whereKey($electionId)
                ->value('title');
        }

        $voters = $query->paginate((int) ($data['per_page'] ?? 25));

        $rows = $voters->getCollection()->map(
            fn (User $voter): array => $this->toAttendanceRow($voter, $electionId, $electionTitle, 'manual')
        )->values()->all();

        return response()->json([
            'data' => $rows,
            'meta' => [
                'current_page' => $voters->currentPage(),
                'last_page' => $voters->lastPage(),
                'per_page' => $voters->perPage(),
                'total' => $voters->total(),
            ],
            'summary' => [
                'total' => $totalCount,
                'present' => $presentCount,
                'absent' => $absentCount,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'election_id' => ['required', 'integer', 'exists:elections,id'],
            'voter_id' => ['required', 'string', 'max:100'],
            'status' => ['required', 'in:present,absent'],
            'checked_in_at' => ['nullable', 'date'],
        ]);

        $voter = User::query()
            ->where('role', UserRole::VOTER->value)
            ->where('voter_id', trim((string) $data['voter_id']))
            ->first();

        if (! $voter) {
            return response()->json([
                'message' => 'No user registered',
            ], 422);
        }

        $status = (string) $data['status'];
        $isAlreadyPresent = $voter->attendance_status === AttendanceStatus::PRESENT->value;

        if ($status === AttendanceStatus::PRESENT->value && $isAlreadyPresent) {
            return response()->json([
                'message' => "{$voter->name} is already marked as present",
            ], 409);
        }

        $checkedInAt = $status === AttendanceStatus::PRESENT->value
            ? ($data['checked_in_at'] ?? now()->toIso8601String())
            : null;

        $voter->forceFill([
            'attendance_status' => $status,
        ])->save();

        $electionId = (int) $data['election_id'];
        $electionTitle = Election::query()
            ->whereKey($electionId)
            ->value('title');

        AuditLogger::log(
            $request,
            'attendance.upsert',
            "Attendance updated for voter #{$voter->id} in election #{$electionId}."
        );

        return response()->json([
            'message' => $status === AttendanceStatus::PRESENT->value
                ? "{$voter->name} is now marked as present in attendance."
                : "Attendance updated for {$voter->name}",
            'data' => $this->toAttendanceRow($voter->fresh(), $electionId, $electionTitle, 'manual', $checkedInAt),
        ], 201);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        /** @var UploadedFile $file */
        $file = $request->file('file');
        $rows = $this->readCsvFile($file);

        if (count($rows) < 2) {
            return response()->json([
                'message' => 'The CSV file must include a header row and at least one attendance row.',
            ], 422);
        }

        $headers = array_map(
            fn ($header): string => Str::snake(trim((string) preg_replace('/^\xEF\xBB\xBF/', '', (string) $header))),
            $rows[0]
        );

        if (! in_array('voter_id', $headers, true)
            || ! in_array('status', $headers, true)) {
            return response()->json([
                'message' => 'CSV must contain VOTER ID and STATUS columns.',
            ], 422);
        }

        $payloads = [];
        $errors = [];

        foreach (array_slice($rows, 1) as $index => $rowValues) {
            $line = $index + 2;
            $row = [];

            foreach ($headers as $position => $header) {
                $row[$header] = isset($rowValues[$position]) ? trim((string) $rowValues[$position]) : null;
            }

            $isEmptyRow = collect($row)->every(fn ($value): bool => $value === null || $value === '');
            if ($isEmptyRow) {
                continue;
            }

            $status = $this->parseAttendanceStatus($row['status'] ?? null);
            if ($status === null) {
                $errors[] = [
                    'line' => $line,
                    'message' => 'STATUS must be present or absent.',
                ];

                continue;
            }

            $normalized = [
                'voter_id' => $row['voter_id'] ?? null,
                'status' => $status,
            ];

            $validator = Validator::make($normalized, [
                'voter_id' => ['required', 'string', 'max:100'],
                'status' => ['required', 'in:present,absent'],
            ]);

            if ($validator->fails()) {
                $errors[] = [
                    'line' => $line,
                    'message' => $validator->errors()->first(),
                ];

                continue;
            }

            $voter = User::query()
                ->where('role', UserRole::VOTER->value)
                ->where('voter_id', $normalized['voter_id'])
                ->first();

            if (! $voter) {
                $errors[] = [
                    'line' => $line,
                    'message' => 'Voter ID was not found.',
                ];

                continue;
            }

            $payloads[] = [
                'user_id' => $voter->id,
                'status' => $normalized['status'],
            ];
        }

        if (count($errors) > 0) {
            return response()->json([
                'message' => 'Attendance import failed due to CSV validation errors.',
                'errors' => $errors,
            ], 422);
        }

        $updated = 0;

        DB::transaction(function () use ($payloads, &$updated): void {
            foreach ($payloads as $payload) {
                $affected = User::query()
                    ->whereKey($payload['user_id'])
                    ->update([
                        'attendance_status' => $payload['status'],
                    ]);

                if ($affected > 0) {
                    $updated++;
                }
            }
        });

        AuditLogger::log(
            $request,
            'attendance.import',
            "Attendance import completed. Updated: {$updated}, Processed: ".count($payloads).'.'
        );

        return response()->json([
            'message' => 'Attendance imported successfully.',
            'meta' => [
                'created' => 0,
                'updated' => $updated,
                'total_processed' => count($payloads),
            ],
        ]);
    }

    private function readCsvFile(UploadedFile $file): array
    {
        $rows = [];
        $handle = fopen($file->getRealPath(), 'r');

        if (! $handle) {
            return $rows;
        }

        while (($data = fgetcsv($handle)) !== false) {
            $rows[] = $data;
        }

        fclose($handle);

        return $rows;
    }

    private function parseAttendanceStatus(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $normalized = strtolower(trim($value));

        return match ($normalized) {
            'present', 'p', '1', 'yes', 'true' => AttendanceStatus::PRESENT->value,
            'absent', 'a', '0', 'no', 'false' => AttendanceStatus::ABSENT->value,
            default => null,
        };
    }

    private function toAttendanceRow(
        User $voter,
        ?int $electionId,
        ?string $electionTitle,
        string $source,
        ?string $checkedInAtOverride = null
    ): array {
        $status = in_array($voter->attendance_status, ['present', 'absent'], true)
            ? $voter->attendance_status
            : AttendanceStatus::ABSENT->value;

        $checkedInAt = $status === AttendanceStatus::PRESENT->value
            ? ($checkedInAtOverride ?? optional($voter->updated_at)->toIso8601String())
            : null;

        return [
            'id' => $voter->id,
            'election_id' => $electionId ?? 0,
            'user_id' => $voter->id,
            'status' => $status,
            'checked_in_at' => $checkedInAt,
            'source' => $source,
            'election' => $electionId !== null ? [
                'id' => $electionId,
                'title' => $electionTitle,
            ] : null,
            'user' => [
                'id' => $voter->id,
                'name' => $voter->name,
                'branch' => $voter->branch,
                'voter_id' => $voter->voter_id,
                'attendance_status' => $status,
                'already_voted' => (bool) $voter->already_voted,
            ],
            'created_at' => optional($voter->created_at)->toIso8601String(),
            'updated_at' => optional($voter->updated_at)->toIso8601String(),
        ];
    }
}
