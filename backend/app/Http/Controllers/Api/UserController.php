<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Models\Vote;
use App\Services\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UserController extends Controller
{
    public function voters(Request $request): JsonResponse
    {
        if (! $request->user()->isSuperAdmin() && ! $request->user()->isElectionAdmin()) {
            return response()->json([
                'message' => 'Forbidden.',
            ], 403);
        }

        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'election_id' => ['nullable', 'integer', 'exists:elections,id'],
            'branch' => ['nullable', 'string', 'max:255'],
        ]);

        $voters = $this->buildVotersQuery($data['search'] ?? null, $data['branch'] ?? null)
            ->paginate($data['per_page'] ?? 25);

        $this->appendVoteStatus($voters->getCollection(), $data['election_id'] ?? null);

        return response()->json([
            'data' => UserResource::collection($voters->getCollection()),
            'meta' => [
                'current_page' => $voters->currentPage(),
                'last_page' => $voters->lastPage(),
                'per_page' => $voters->perPage(),
                'total' => $voters->total(),
            ],
        ]);
    }

    public function indexUsers(Request $request): JsonResponse
    {
        if (! $request->user()->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only super admins can view user management data.',
            ], 403);
        }

        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'role' => ['nullable', Rule::in($this->manageableUserRoles())],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $query = User::query()
            ->whereIn('role', $this->manageableUserRoles())
            ->orderByDesc('created_at');

        if (! empty($data['search'])) {
            $search = (string) $data['search'];
            $query->where(function ($builder) use ($search): void {
                $builder->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%');
            });
        }

        if (! empty($data['role'])) {
            $query->where('role', $data['role']);
        }

        $users = $query->paginate($data['per_page'] ?? 25);

        return response()->json([
            'data' => UserResource::collection($users->getCollection()),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function storeUser(Request $request): JsonResponse
    {
        if (! $request->user()->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only super admins can create users.',
            ], 403);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'role' => ['required', Rule::in($this->manageableUserRoles())],
            'is_active' => ['nullable', 'boolean'],
            'password' => ['nullable', 'string', 'min:8', 'max:255'],
        ]);

        $createdUser = User::create([
            'name' => $data['name'],
            'branch' => null,
            'email' => strtolower((string) $data['email']),
            'role' => $data['role'],
            'is_active' => isset($data['is_active']) ? (bool) $data['is_active'] : true,
            'voter_id' => null,
            'voter_key' => null,
            'password' => ! empty($data['password']) ? $data['password'] : 'Password@123',
        ]);

        AuditLogger::log(
            $request,
            'user.create',
            "User #{$createdUser->id} created with role {$createdUser->role}."
        );

        return response()->json([
            'data' => new UserResource($createdUser),
        ], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        if (! $request->user()->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only super admins can update users.',
            ], 403);
        }

        if ($user->isVoter()) {
            return response()->json([
                'message' => 'Voter accounts are managed in the Voters module.',
            ], 422);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['required', Rule::in($this->manageableUserRoles())],
            'is_active' => ['required', 'boolean'],
            'password' => ['nullable', 'string', 'min:8', 'max:255'],
        ]);

        $actor = $request->user();
        $targetRole = (string) $data['role'];

        if ($actor->id === $user->id && $targetRole !== UserRole::SUPER_ADMIN->value) {
            return response()->json([
                'message' => 'You cannot remove your own super admin role.',
            ], 422);
        }

        if ($actor->id === $user->id && $data['is_active'] === false) {
            return response()->json([
                'message' => 'You cannot deactivate your own account.',
            ], 422);
        }

        if ($user->isSuperAdmin() && $targetRole !== UserRole::SUPER_ADMIN->value && ! $this->canModifySuperAdmin($user->id)) {
            return response()->json([
                'message' => 'At least one active super admin account is required.',
            ], 422);
        }

        if ($user->isSuperAdmin() && $data['is_active'] === false && ! $this->canModifySuperAdmin($user->id)) {
            return response()->json([
                'message' => 'At least one active super admin account is required.',
            ], 422);
        }

        $payload = [
            'name' => $data['name'],
            'branch' => null,
            'email' => strtolower((string) $data['email']),
            'role' => $targetRole,
            'is_active' => (bool) $data['is_active'],
            'voter_id' => null,
            'voter_key' => null,
        ];

        if (! empty($data['password'])) {
            $payload['password'] = $data['password'];
        }

        $user->update($payload);

        AuditLogger::log(
            $request,
            'user.update',
            "User #{$user->id} updated."
        );

        return response()->json([
            'data' => new UserResource($user->fresh()),
        ]);
    }

    public function deleteUser(Request $request, User $user): JsonResponse
    {
        if (! $request->user()->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only super admins can delete users.',
            ], 403);
        }

        if ($request->user()->id === $user->id) {
            return response()->json([
                'message' => 'You cannot delete your own account.',
            ], 422);
        }

        if ($user->isSuperAdmin() && ! $this->canModifySuperAdmin($user->id)) {
            return response()->json([
                'message' => 'At least one active super admin account is required.',
            ], 422);
        }

        if ($user->isVoter()) {
            return response()->json([
                'message' => 'Voter accounts are managed in the Voters module.',
            ], 422);
        }

        $targetUserId = $user->id;
        $user->delete();

        AuditLogger::log(
            $request,
            'user.delete',
            "User #{$targetUserId} deleted."
        );

        return response()->json([
            'message' => 'User deleted successfully.',
        ]);
    }

    public function downloadTemplate(Request $request): StreamedResponse
    {
        if (! $request->user()->isSuperAdmin() && ! $request->user()->isElectionAdmin()) {
            abort(403, 'Forbidden.');
        }

        AuditLogger::log(
            $request,
            'voter.template_download',
            'Voter CSV import template downloaded.'
        );

        return response()->streamDownload(function (): void {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, ['NAME', 'BRANCH', 'EMAIL', 'IS ACTIVE']);
            fputcsv($handle, ['Grace Ann', 'Main Office', 'grace@voting.local', '1']);
            fputcsv($handle, ['jp', 'North Branch', 'jp@voting.local', '1']);

            fclose($handle);
        }, 'voter_import_template.csv', ['Content-Type' => 'text/csv']);
    }

    public function voterImportProgress(Request $request, string $importId): JsonResponse
    {
        if (! $request->user()->isSuperAdmin() && ! $request->user()->isElectionAdmin()) {
            return response()->json([
                'message' => 'Forbidden.',
            ], 403);
        }

        $validator = Validator::make(
            ['import_id' => $importId],
            ['import_id' => ['required', 'string', 'max:120']]
        );

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $progress = Cache::get($this->voterImportProgressCacheKey($importId));
        if (! is_array($progress)) {
            return response()->json([
                'message' => 'Import progress not found. Start a new import.',
            ], 404);
        }

        return response()->json([
            'data' => $progress,
        ]);
    }

    public function importVoters(Request $request): JsonResponse
    {
        if (! $request->user()->isSuperAdmin() && ! $request->user()->isElectionAdmin()) {
            return response()->json([
                'message' => 'Forbidden.',
            ], 403);
        }

        if (function_exists('set_time_limit')) {
            @set_time_limit(0);
        }

        @ini_set('max_execution_time', '0');

        $request->validate([
            'import_id' => ['required', 'string', 'max:120'],
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $importId = (string) $request->input('import_id');
        $this->setVoterImportProgress($importId, [
            'status' => 'upload_received',
            'percent' => 0,
            'processed' => 0,
            'total' => 0,
            'created' => 0,
            'updated' => 0,
            'message' => 'Upload received. Preparing voter import.',
        ]);

        /** @var UploadedFile $file */
        $file = $request->file('file');
        $rows = $this->readCsvFile($file);

        if (count($rows) < 2) {
            $this->setVoterImportProgress($importId, [
                'status' => 'failed',
                'percent' => 0,
                'processed' => 0,
                'total' => 0,
                'created' => 0,
                'updated' => 0,
                'message' => 'The CSV file must include a header row and at least one voter row.',
            ]);

            return response()->json([
                'message' => 'The CSV file must include a header row and at least one voter row.',
            ], 422);
        }

        $headerRowIndex = null;
        $headers = [];

        foreach ($rows as $index => $rowValues) {
            $firstCell = strtolower(trim((string) ($rowValues[0] ?? '')));

            // Excel may prepend "sep=," or "sep=;" as the first line.
            if (count($rowValues) <= 2 && str_starts_with($firstCell, 'sep=')) {
                continue;
            }

            $candidateHeaders = array_map(
                fn ($header): string => $this->normalizeCsvHeader((string) $header),
                $rowValues
            );

            if (in_array('name', $candidateHeaders, true)) {
                $headerRowIndex = $index;
                $headers = $candidateHeaders;
                break;
            }
        }

        if ($headerRowIndex === null) {
            $this->setVoterImportProgress($importId, [
                'status' => 'failed',
                'percent' => 0,
                'processed' => 0,
                'total' => 0,
                'created' => 0,
                'updated' => 0,
                'message' => 'CSV must contain at least a NAME column.',
            ]);

            return response()->json([
                'message' => 'CSV must contain at least a NAME column.',
            ], 422);
        }

        if (! in_array('name', $headers, true)) {
            $this->setVoterImportProgress($importId, [
                'status' => 'failed',
                'percent' => 0,
                'processed' => 0,
                'total' => 0,
                'created' => 0,
                'updated' => 0,
                'message' => 'CSV must contain at least a NAME column.',
            ]);

            return response()->json([
                'message' => 'CSV must contain at least a NAME column.',
            ], 422);
        }

        $this->setVoterImportProgress($importId, [
            'status' => 'validating',
            'percent' => 0,
            'processed' => 0,
            'total' => 0,
            'created' => 0,
            'updated' => 0,
            'message' => 'Validating CSV rows.',
        ]);

        $payloads = [];
        $errors = [];
        $seenEmails = [];

        foreach (array_slice($rows, $headerRowIndex + 1) as $index => $rowValues) {
            $line = $headerRowIndex + $index + 2;
            $row = [];

            foreach ($headers as $position => $header) {
                $row[$header] = isset($rowValues[$position])
                    ? $this->normalizeCsvCell(trim((string) $rowValues[$position]))
                    : null;
            }

            $isEmptyRow = collect($row)->every(fn ($value): bool => $value === null || $value === '');
            if ($isEmptyRow) {
                continue;
            }

            $normalized = [
                'name' => $this->normalizeCsvCell($row['name'] ?? null),
                'branch' => ($this->normalizeCsvCell($row['branch'] ?? null)) ?: null,
                'email' => isset($row['email']) && trim((string) $row['email']) !== ''
                    ? strtolower((string) $this->normalizeCsvCell((string) $row['email']))
                    : null,
            ];

            $isActiveParsed = $this->parseBoolean($row['is_active'] ?? null);
            if (($row['is_active'] ?? null) !== null && trim((string) $row['is_active']) !== '' && $isActiveParsed === null) {
                $errors[] = [
                    'line' => $line,
                    'message' => 'IS ACTIVE must be one of: 1, 0, true, false, yes, no, active, inactive.',
                ];

                continue;
            }

            $normalized['is_active'] = $isActiveParsed ?? true;

            $validator = Validator::make($normalized, [
                'name' => ['required', 'string', 'max:255'],
                'branch' => ['nullable', 'string', 'max:255'],
                'email' => ['nullable', 'email', 'max:255'],
                'is_active' => ['required', 'boolean'],
            ]);

            if ($validator->fails()) {
                $errors[] = [
                    'line' => $line,
                    'message' => $validator->errors()->first(),
                ];

                continue;
            }

            if ($normalized['email'] !== null) {
                if (in_array($normalized['email'], $seenEmails, true)) {
                    $errors[] = [
                        'line' => $line,
                        'message' => 'Duplicate email found within the CSV file.',
                    ];

                    continue;
                }

                $seenEmails[] = $normalized['email'];
            }

            $payloads[] = [
                'line' => $line,
                'data' => $normalized,
            ];
        }

        $emails = collect($payloads)
            ->map(fn (array $payload): ?string => $payload['data']['email'] ?? null)
            ->filter()
            ->unique()
            ->values();

        $existingUsersByEmail = $emails->isEmpty()
            ? collect()
            : User::query()
                ->whereIn('email', $emails->all())
                ->get()
                ->keyBy(fn (User $user): string => strtolower((string) $user->email));

        foreach ($payloads as $payload) {
            $email = $payload['data']['email'] ?? null;

            if ($email === null) {
                continue;
            }

            $existingUser = $existingUsersByEmail->get($email);
            if ($existingUser && ! $existingUser->isVoter()) {
                $errors[] = [
                    'line' => $payload['line'],
                    'message' => 'This email belongs to a non-voter account and cannot be imported as voter.',
                ];
            }
        }

        if (count($errors) > 0) {
            $this->setVoterImportProgress($importId, [
                'status' => 'failed',
                'percent' => 0,
                'processed' => 0,
                'total' => count($payloads),
                'created' => 0,
                'updated' => 0,
                'message' => 'Import failed due to CSV validation errors.',
            ]);

            return response()->json([
                'message' => 'Import failed due to CSV validation errors.',
                'errors' => $errors,
            ], 422);
        }

        $totalPayloads = count($payloads);
        $created = 0;
        $updated = 0;
        $processed = 0;
        $lastReportedPercent = -1;
        $defaultPasswordHash = Hash::make('Password@123');

        $this->setVoterImportProgress($importId, [
            'status' => 'importing',
            'percent' => 0,
            'processed' => 0,
            'total' => $totalPayloads,
            'created' => 0,
            'updated' => 0,
            'message' => 'Importing voters...',
        ]);

        try {
            DB::transaction(function () use (
                $payloads,
                $existingUsersByEmail,
                $defaultPasswordHash,
                $totalPayloads,
                $importId,
                &$created,
                &$updated,
                &$processed,
                &$lastReportedPercent
            ): void {
                foreach ($payloads as $payloadItem) {
                    $payload = $payloadItem['data'];
                    $existingUser = $payload['email'] !== null
                        ? $existingUsersByEmail->get($payload['email'])
                        : null;

                    $attributes = [
                        'name' => $payload['name'],
                        'branch' => $payload['branch'],
                        'role' => 'voter',
                        'is_active' => (bool) $payload['is_active'],
                    ];

                    if ($existingUser) {
                        $existingUser->fill($attributes);
                        $existingUser->save();
                        $user = $existingUser;
                        $updated++;
                    } else {
                        $user = User::create([
                            ...$attributes,
                            'email' => $payload['email'],
                            'password' => $defaultPasswordHash,
                        ]);

                        if ($payload['email'] !== null) {
                            $existingUsersByEmail->put($payload['email'], $user);
                        }

                        $created++;
                    }

                    $shouldSave = false;

                    if (! $user->voter_id) {
                        $user->voter_id = $this->generateUniqueVoterId($user->name, $user->id);
                        $shouldSave = true;
                    }

                    if (! $user->voter_key) {
                        $user->voter_key = $this->generateVoterKeyFromName($user->name);
                        $shouldSave = true;
                    }

                    if ($shouldSave) {
                        $user->save();
                    }

                    $processed++;
                    $percent = $totalPayloads > 0
                        ? (int) floor(($processed / $totalPayloads) * 100)
                        : 100;

                    if ($percent !== $lastReportedPercent || $processed === $totalPayloads) {
                        $lastReportedPercent = $percent;
                        $this->setVoterImportProgress($importId, [
                            'status' => 'importing',
                            'percent' => $percent,
                            'processed' => $processed,
                            'total' => $totalPayloads,
                            'created' => $created,
                            'updated' => $updated,
                            'message' => 'Importing voters...',
                        ]);
                    }
                }
            });
        } catch (\Throwable $exception) {
            $this->setVoterImportProgress($importId, [
                'status' => 'failed',
                'percent' => $totalPayloads > 0 ? (int) floor(($processed / $totalPayloads) * 100) : 0,
                'processed' => $processed,
                'total' => $totalPayloads,
                'created' => $created,
                'updated' => $updated,
                'message' => 'Import failed while processing records.',
            ]);

            throw $exception;
        }

        AuditLogger::log(
            $request,
            'voter.import',
            "Voter import completed. Created: {$created}, Updated: {$updated}, Processed: {$totalPayloads}."
        );

        $this->setVoterImportProgress($importId, [
            'status' => 'completed',
            'percent' => 100,
            'processed' => $totalPayloads,
            'total' => $totalPayloads,
            'created' => $created,
            'updated' => $updated,
            'message' => 'Voter import completed.',
        ]);

        return response()->json([
            'message' => 'Voters imported successfully.',
            'meta' => [
                'created' => $created,
                'updated' => $updated,
                'total_processed' => $totalPayloads,
            ],
        ]);
    }

    public function storeVoter(Request $request): JsonResponse
    {
        if (! $request->user()->isSuperAdmin() && ! $request->user()->isElectionAdmin()) {
            return response()->json([
                'message' => 'Forbidden.',
            ], 403);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'branch' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'voter_id' => ['required', 'string', 'max:100', 'unique:users,voter_id'],
            'voter_key' => ['required', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $voter = User::create([
            'name' => $data['name'],
            'branch' => $data['branch'] ?? null,
            'email' => ! empty($data['email']) ? strtolower((string) $data['email']) : null,
            'voter_id' => $data['voter_id'],
            'voter_key' => $data['voter_key'],
            'password' => 'Password@123',
            'role' => 'voter',
            'is_active' => isset($data['is_active']) ? (bool) $data['is_active'] : true,
        ]);

        AuditLogger::log(
            $request,
            'voter.create',
            "Voter #{$voter->id} created."
        );

        return response()->json([
            'data' => new UserResource($voter),
        ], 201);
    }

    public function updateVoter(Request $request, User $user): JsonResponse
    {
        if (! $request->user()->isSuperAdmin() && ! $request->user()->isElectionAdmin()) {
            return response()->json([
                'message' => 'Forbidden.',
            ], 403);
        }

        if (! $user->isVoter()) {
            return response()->json([
                'message' => 'Update is limited to voter accounts.',
            ], 422);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'branch' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'voter_id' => ['required', 'string', 'max:100', Rule::unique('users', 'voter_id')->ignore($user->id)],
            'voter_key' => ['required', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $user->update([
            'name' => $data['name'],
            'branch' => $data['branch'] ?? null,
            'email' => ! empty($data['email']) ? strtolower((string) $data['email']) : null,
            'voter_id' => $data['voter_id'],
            'voter_key' => $data['voter_key'],
            'is_active' => isset($data['is_active']) ? (bool) $data['is_active'] : $user->is_active,
        ]);

        AuditLogger::log(
            $request,
            'voter.update',
            "Voter #{$user->id} updated."
        );

        return response()->json([
            'data' => new UserResource($user->fresh()),
        ]);
    }

    public function exportVoters(Request $request): StreamedResponse
    {
        if (! $request->user()->isSuperAdmin() && ! $request->user()->isElectionAdmin()) {
            abort(403, 'Forbidden.');
        }

        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'election_id' => ['nullable', 'integer', 'exists:elections,id'],
            'branch' => ['nullable', 'string', 'max:255'],
        ]);

        $electionId = $data['election_id'] ?? null;
        $voters = $this->buildVotersQuery($data['search'] ?? null, $data['branch'] ?? null)->get();
        $this->appendVoteStatus($voters, $electionId);

        AuditLogger::log(
            $request,
            'voter.export',
            'Voter list exported'.($electionId ? " for election #{$electionId}." : '.')
        );

        return response()->streamDownload(function () use ($voters): void {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, ['NAME', 'BRANCH', 'EMAIL', 'IS ACTIVE', 'VOTER KEY', 'VOTER ID']);

            foreach ($voters as $voter) {
                fputcsv($handle, [
                    $voter->name,
                    $voter->branch,
                    $voter->email,
                    $voter->is_active ? '1' : '0',
                    $voter->voter_key,
                    $voter->voter_id,
                ]);
            }

            fclose($handle);
        }, 'voters.csv', ['Content-Type' => 'text/csv']);
    }

    public function exportVoterLogs(Request $request): StreamedResponse
    {
        if (! $request->user()->isSuperAdmin() && ! $request->user()->isElectionAdmin()) {
            abort(403, 'Forbidden.');
        }

        $data = $request->validate([
            'election_id' => ['required', 'integer', 'exists:elections,id'],
            'search' => ['nullable', 'string', 'max:255'],
            'branch' => ['nullable', 'string', 'max:255'],
        ]);

        $electionId = (int) $data['election_id'];
        $voters = $this->buildVotersQuery($data['search'] ?? null, $data['branch'] ?? null)->get();
        $this->appendVoteStatus($voters, $electionId);

        AuditLogger::log(
            $request,
            'voter.logs_export',
            "Voter logs exported for election #{$electionId}."
        );

        return response()->streamDownload(function () use ($voters, $electionId): void {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, ['NAME', 'BRANCH', 'VOTER ID', 'VOTER KEY', 'ELECTION ID', 'VOTED?', 'VOTED AT', 'VOTER HASH']);

            foreach ($voters as $voter) {
                fputcsv($handle, [
                    $voter->name,
                    $voter->branch,
                    $voter->voter_id,
                    $voter->voter_key,
                    $electionId,
                    $voter->has_voted ? 'YES' : 'NO',
                    $voter->voted_at,
                    Vote::voterHash($voter->id, $electionId),
                ]);
            }

            fclose($handle);
        }, "voter_logs_election_{$electionId}.csv", ['Content-Type' => 'text/csv']);
    }

    public function updateVoterStatus(Request $request, User $user): JsonResponse
    {
        if (! $request->user()->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only super admins can update voter status.',
            ], 403);
        }

        if (! $user->isVoter()) {
            return response()->json([
                'message' => 'Status update is limited to voter accounts.',
            ], 422);
        }

        $data = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $user->update([
            'is_active' => (bool) $data['is_active'],
        ]);

        AuditLogger::log(
            $request,
            'user.voter_status_update',
            "Voter #{$user->id} status changed to ".($user->is_active ? 'active' : 'inactive').'.'
        );

        return response()->json([
            'data' => new UserResource($user),
        ]);
    }

    public function deleteVoter(Request $request, User $user): JsonResponse
    {
        if (! $request->user()->isSuperAdmin() && ! $request->user()->isElectionAdmin()) {
            return response()->json([
                'message' => 'Forbidden.',
            ], 403);
        }

        if (! $user->isVoter()) {
            return response()->json([
                'message' => 'Deletion is limited to voter accounts.',
            ], 422);
        }

        if ($request->user()->id === $user->id) {
            return response()->json([
                'message' => 'You cannot delete your own account.',
            ], 422);
        }

        if ($this->hasVotesInAnyElection($user)) {
            return response()->json([
                'message' => 'Cannot delete voter who already cast votes. Deactivate instead for audit integrity.',
            ], 422);
        }

        $voterId = $user->id;
        $user->delete();

        AuditLogger::log(
            $request,
            'voter.delete',
            "Voter #{$voterId} deleted."
        );

        return response()->json([
            'message' => 'Voter deleted successfully.',
        ]);
    }

    private function buildVotersQuery(?string $search = null, ?string $branch = null): Builder
    {
        $query = User::query()
            ->where('role', 'voter')
            ->orderBy('name');

        if ($branch) {
            $query->where('branch', $branch);
        }

        if ($search) {
            $query->where(function ($builder) use ($search): void {
                $builder->where('name', 'like', '%'.$search.'%')
                    ->orWhere('branch', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhere('voter_id', 'like', '%'.$search.'%');
            });
        }

        return $query;
    }

    private function appendVoteStatus(EloquentCollection $voters, ?int $electionId): void
    {
        if ($voters->isEmpty()) {
            return;
        }

        if (! $electionId) {
            foreach ($voters as $voter) {
                $voter->setAttribute('has_voted', false);
                $voter->setAttribute('voted_at', null);
            }

            return;
        }

        $hashesByUserId = $voters->mapWithKeys(fn (User $voter): array => [
            $voter->id => Vote::voterHash($voter->id, $electionId),
        ]);

        $voteRows = Vote::query()
            ->where('election_id', $electionId)
            ->whereIn('voter_hash', $hashesByUserId->values()->all())
            ->selectRaw('voter_hash, MAX(created_at) as voted_at')
            ->groupBy('voter_hash')
            ->get()
            ->keyBy('voter_hash');

        foreach ($voters as $voter) {
            $hash = $hashesByUserId[$voter->id];
            $matchedVote = $voteRows->get($hash);

            $voter->setAttribute('has_voted', (bool) $matchedVote);
            $voter->setAttribute('voted_at', $matchedVote?->voted_at);
        }
    }

    private function readCsvFile(UploadedFile $file): array
    {
        $realPath = $file->getRealPath();
        if (! is_string($realPath) || $realPath === '') {
            return [];
        }

        $content = file_get_contents($realPath);
        if ($content === false) {
            return [];
        }

        $normalizedContent = $this->normalizeCsvEncoding($content);
        $candidateDelimiters = [',', ';', "\t", '|'];
        $bestRows = [];
        $bestScore = -1;

        foreach ($candidateDelimiters as $delimiter) {
            $rows = $this->parseCsvRowsFromContent($normalizedContent, $delimiter);
            if ($rows === []) {
                continue;
            }

            $maxColumns = max(array_map(fn ($row): int => count($row), $rows));
            $hasNameAndEmailHeader = collect($rows)->contains(function (array $row): bool {
                $headers = array_map(fn ($header): string => $this->normalizeCsvHeader((string) $header), $row);
                return in_array('name', $headers, true) && in_array('email', $headers, true);
            });

            $score = ($hasNameAndEmailHeader ? 1000 : 0) + $maxColumns;
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestRows = $rows;
            }
        }

        if ($bestRows !== []) {
            return $bestRows;
        }

        return $this->parseCsvRowsFromContent($normalizedContent, ',');
    }

    private function parseCsvRowsFromContent(string $content, string $delimiter): array
    {
        $rows = [];
        $handle = fopen('php://temp', 'r+');
        if (! $handle) {
            return $rows;
        }

        fwrite($handle, $content);
        rewind($handle);

        while (($data = fgetcsv($handle, 0, $delimiter)) !== false) {
            if ($data === [null]) {
                continue;
            }

            $rows[] = array_map(
                fn ($value): ?string => $this->normalizeCsvCell($value === null ? null : (string) $value),
                $data
            );
        }

        fclose($handle);

        return $rows;
    }

    private function normalizeCsvEncoding(string $content): string
    {
        if (str_starts_with($content, "\xEF\xBB\xBF")) {
            return substr($content, 3);
        }

        if (str_starts_with($content, "\xFF\xFE")) {
            return $this->convertToUtf8($content, 'UTF-16LE');
        }

        if (str_starts_with($content, "\xFE\xFF")) {
            return $this->convertToUtf8($content, 'UTF-16BE');
        }

        if (str_contains($content, "\x00")) {
            return $this->convertToUtf8($content, 'UTF-16LE');
        }

        if (function_exists('mb_check_encoding') && function_exists('mb_convert_encoding')) {
            if (! mb_check_encoding($content, 'UTF-8')) {
                $detected = mb_detect_encoding(
                    $content,
                    ['Windows-1252', 'ISO-8859-1', 'ISO-8859-15', 'UTF-8'],
                    true
                );

                if ($detected !== false && strtoupper($detected) !== 'UTF-8') {
                    $converted = @mb_convert_encoding($content, 'UTF-8', $detected);
                    if ($converted !== false) {
                        return (string) $converted;
                    }
                }

                $fallback = @mb_convert_encoding($content, 'UTF-8', 'Windows-1252');
                if ($fallback !== false) {
                    return (string) $fallback;
                }
            }
        }

        return $content;
    }

    private function convertToUtf8(string $content, string $fromEncoding): string
    {
        if (function_exists('mb_convert_encoding')) {
            $converted = @mb_convert_encoding($content, 'UTF-8', $fromEncoding);
            if ($converted !== false) {
                return (string) $converted;
            }
        }

        if (function_exists('iconv')) {
            $converted = iconv($fromEncoding, 'UTF-8//IGNORE', $content);
            if ($converted !== false) {
                return $converted;
            }
        }

        return $content;
    }

    private function normalizeCsvCell(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        if ($value === '') {
            return '';
        }

        if (function_exists('mb_check_encoding') && mb_check_encoding($value, 'UTF-8')) {
            return $value;
        }

        if (function_exists('mb_convert_encoding')) {
            $detected = mb_detect_encoding(
                $value,
                ['UTF-8', 'Windows-1252', 'ISO-8859-1', 'ISO-8859-15', 'UTF-16LE', 'UTF-16BE'],
                true
            );

            if ($detected !== false) {
                $converted = @mb_convert_encoding($value, 'UTF-8', $detected);
                if ($converted !== false && (! function_exists('mb_check_encoding') || mb_check_encoding($converted, 'UTF-8'))) {
                    return (string) $converted;
                }
            }

            $fallback = @mb_convert_encoding($value, 'UTF-8', 'Windows-1252');
            if ($fallback !== false && (! function_exists('mb_check_encoding') || mb_check_encoding($fallback, 'UTF-8'))) {
                return (string) $fallback;
            }
        }

        if (function_exists('iconv')) {
            foreach (['Windows-1252', 'ISO-8859-1', 'ISO-8859-15'] as $encoding) {
                $converted = @iconv($encoding, 'UTF-8//IGNORE', $value);
                if ($converted !== false && $converted !== '') {
                    return $converted;
                }
            }

            $cleaned = @iconv('UTF-8', 'UTF-8//IGNORE', $value);
            if ($cleaned !== false) {
                return $cleaned;
            }
        }

        return preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value) ?? '';
    }

    private function normalizeCsvHeader(string $header): string
    {
        $clean = preg_replace('/^\xEF\xBB\xBF/u', '', $header) ?? $header;
        $clean = str_replace(["\u{00A0}", "\u{FEFF}"], ' ', $clean);
        $clean = preg_replace('/[\x{200B}-\x{200D}\x{2060}]/u', '', $clean) ?? $clean;
        $clean = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $clean) ?? $clean;
        $clean = preg_replace('/\s+/u', ' ', trim($clean)) ?? trim($clean);
        $snake = Str::snake($clean);
        $collapsed = strtolower(str_replace('_', '', $snake));

        return match (true) {
            $collapsed === 'name', $collapsed === 'fullname', $collapsed === 'votername' => 'name',
            $collapsed === 'email', $collapsed === 'emailaddress', str_starts_with($collapsed, 'email') => 'email',
            $collapsed === 'isactive', $collapsed === 'active', $collapsed === 'status' => 'is_active',
            $collapsed === 'branch' => 'branch',
            $collapsed === 'voterid' => 'voter_id',
            $collapsed === 'voterkey' => 'voter_key',
            default => $snake,
        };
    }

    private function parseBoolean(?string $value): ?bool
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $normalized = strtolower(trim($value));

        return match ($normalized) {
            '1', 'true', 'yes', 'y', 'active' => true,
            '0', 'false', 'no', 'n', 'inactive' => false,
            default => null,
        };
    }

    private function generateUniqueVoterId(string $name, int $userId): string
    {
        $firstName = trim((string) Str::of($name)->before(' '));
        $base = (string) Str::of($firstName)->replaceMatches('/[^A-Za-z0-9]/', '')->value();

        if ($base === '') {
            $base = 'voter'.$userId;
        }

        $base = ucfirst(strtolower($base));
        $candidate = $base;
        $counter = 1;

        while (User::query()->where('voter_id', $candidate)->where('id', '!=', $userId)->exists()) {
            $candidate = $base.$counter;
            $counter++;
        }

        return $candidate;
    }

    private function generateVoterKeyFromName(string $name): string
    {
        $parts = collect(preg_split('/\s+/', trim($name)) ?: [])
            ->map(fn ($part): string => preg_replace('/[^A-Za-z0-9]/', '', (string) $part) ?? '')
            ->filter()
            ->values();

        $firstInitial = strtoupper(substr((string) ($parts[0] ?? 'V'), 0, 1));
        $lastInitial = strtoupper(substr((string) ($parts[count($parts) - 1] ?? $parts[0] ?? 'R'), 0, 1));

        return sprintf(
            '%s%d%s%d',
            $firstInitial !== '' ? $firstInitial : 'V',
            random_int(0, 9),
            $lastInitial !== '' ? $lastInitial : 'R',
            random_int(0, 9)
        );
    }

    private function hasVotesInAnyElection(User $user): bool
    {
        $electionIds = Vote::query()
            ->select('election_id')
            ->distinct()
            ->pluck('election_id');

        if ($electionIds->isEmpty()) {
            return false;
        }

        $hashes = $electionIds
            ->map(fn ($electionId): string => Vote::voterHash($user->id, (int) $electionId))
            ->all();

        return Vote::query()
            ->whereIn('voter_hash', $hashes)
            ->exists();
    }

    /**
     * @return array<int, string>
     */
    private function manageableUserRoles(): array
    {
        return [
            UserRole::SUPER_ADMIN->value,
            UserRole::ELECTION_ADMIN->value,
        ];
    }

    private function canModifySuperAdmin(int $targetUserId): bool
    {
        $activeSuperAdminCount = User::query()
            ->where('role', UserRole::SUPER_ADMIN->value)
            ->where('is_active', true)
            ->count();

        if ($activeSuperAdminCount > 1) {
            return true;
        }

        $isOnlyActiveSuperAdmin = User::query()
            ->where('id', $targetUserId)
            ->where('role', UserRole::SUPER_ADMIN->value)
            ->where('is_active', true)
            ->exists();

        return ! $isOnlyActiveSuperAdmin;
    }

    private function voterImportProgressCacheKey(string $importId): string
    {
        return 'voter_import_progress:'.$importId;
    }

    /**
     * @param  array{
     *   status:string,
     *   percent:int,
     *   processed:int,
     *   total:int,
     *   created:int,
     *   updated:int,
     *   message:string
     * }  $payload
     */
    private function setVoterImportProgress(string $importId, array $payload): void
    {
        Cache::put(
            $this->voterImportProgressCacheKey($importId),
            [
                'status' => $payload['status'],
                'percent' => max(0, min(100, (int) $payload['percent'])),
                'processed' => max(0, (int) $payload['processed']),
                'total' => max(0, (int) $payload['total']),
                'created' => max(0, (int) $payload['created']),
                'updated' => max(0, (int) $payload['updated']),
                'message' => (string) $payload['message'],
                'updated_at' => now()->toIso8601String(),
            ],
            now()->addMinutes(30)
        );
    }
}
