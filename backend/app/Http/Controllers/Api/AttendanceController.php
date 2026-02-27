<?php

namespace App\Http\Controllers\Api;

use App\Enums\AttendanceStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\AttendanceResource;
use App\Models\Attendance;
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

        $query = Attendance::query()
            ->with([
                'election:id,title',
                'user:id,name,branch,voter_id',
            ])
            ->orderByDesc('updated_at');

        if (! empty($data['election_id'])) {
            $query->where('election_id', (int) $data['election_id']);
        }

        if (! empty($data['status'])) {
            $query->where('status', (string) $data['status']);
        }

        if (! empty($data['search'])) {
            $search = (string) $data['search'];
            $query->whereHas('user', function ($builder) use ($search): void {
                $builder->where('name', 'like', '%'.$search.'%')
                    ->orWhere('voter_id', 'like', '%'.$search.'%')
                    ->orWhere('branch', 'like', '%'.$search.'%');
            });
        }

        $totalCount = (clone $query)->count();
        $presentCount = (clone $query)->where('status', AttendanceStatus::PRESENT->value)->count();
        $absentCount = (clone $query)->where('status', AttendanceStatus::ABSENT->value)->count();

        $attendances = $query->paginate((int) ($data['per_page'] ?? 25));

        return response()->json([
            'data' => AttendanceResource::collection($attendances->getCollection()),
            'meta' => [
                'current_page' => $attendances->currentPage(),
                'last_page' => $attendances->lastPage(),
                'per_page' => $attendances->perPage(),
                'total' => $attendances->total(),
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
                'message' => 'Voter ID was not found.',
            ], 422);
        }

        $status = (string) $data['status'];
        $checkedInAt = $data['checked_in_at'] ?? null;

        if ($status === AttendanceStatus::PRESENT->value && ! $checkedInAt) {
            $checkedInAt = now();
        }

        if ($status === AttendanceStatus::ABSENT->value) {
            $checkedInAt = null;
        }

        $attendance = Attendance::query()->updateOrCreate(
            [
                'election_id' => (int) $data['election_id'],
                'user_id' => $voter->id,
            ],
            [
                'status' => $status,
                'checked_in_at' => $checkedInAt,
                'source' => 'manual',
            ]
        );

        AuditLogger::log(
            $request,
            'attendance.upsert',
            "Attendance updated for voter #{$voter->id} in election #{$attendance->election_id}."
        );

        $attendance->load(['election:id,title', 'user:id,name,branch,voter_id']);

        return response()->json([
            'data' => new AttendanceResource($attendance),
        ], 201);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
            'election_id' => ['nullable', 'integer', 'exists:elections,id'],
        ]);

        /** @var UploadedFile $file */
        $file = $request->file('file');
        $defaultElectionId = $request->filled('election_id') ? (int) $request->input('election_id') : null;
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

        if ($defaultElectionId === null && ! in_array('election_id', $headers, true)) {
            return response()->json([
                'message' => 'CSV must include ELECTION ID column when election_id is not provided in the request.',
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
                'election_id' => $defaultElectionId ?? (isset($row['election_id']) ? (int) $row['election_id'] : null),
                'voter_id' => $row['voter_id'] ?? null,
                'status' => $status,
                'checked_in_at' => $row['checked_in_at'] ?? null,
            ];

            $validator = Validator::make($normalized, [
                'election_id' => ['required', 'integer', 'exists:elections,id'],
                'voter_id' => ['required', 'string', 'max:100'],
                'status' => ['required', 'in:present,absent'],
                'checked_in_at' => ['nullable', 'date'],
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
                'election_id' => $normalized['election_id'],
                'user_id' => $voter->id,
                'status' => $normalized['status'],
                'checked_in_at' => $normalized['status'] === AttendanceStatus::ABSENT->value
                    ? null
                    : ($normalized['checked_in_at'] ?: now()),
            ];
        }

        if (count($errors) > 0) {
            return response()->json([
                'message' => 'Attendance import failed due to CSV validation errors.',
                'errors' => $errors,
            ], 422);
        }

        $created = 0;
        $updated = 0;

        DB::transaction(function () use ($payloads, &$created, &$updated): void {
            foreach ($payloads as $payload) {
                $existing = Attendance::query()
                    ->where('election_id', $payload['election_id'])
                    ->where('user_id', $payload['user_id'])
                    ->first();

                if ($existing) {
                    $existing->update([
                        'status' => $payload['status'],
                        'checked_in_at' => $payload['checked_in_at'],
                        'source' => 'import',
                    ]);
                    $updated++;
                } else {
                    Attendance::create([
                        'election_id' => $payload['election_id'],
                        'user_id' => $payload['user_id'],
                        'status' => $payload['status'],
                        'checked_in_at' => $payload['checked_in_at'],
                        'source' => 'import',
                    ]);
                    $created++;
                }
            }
        });

        AuditLogger::log(
            $request,
            'attendance.import',
            "Attendance import completed. Created: {$created}, Updated: {$updated}, Processed: ".count($payloads).'.'
        );

        return response()->json([
            'message' => 'Attendance imported successfully.',
            'meta' => [
                'created' => $created,
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
}
