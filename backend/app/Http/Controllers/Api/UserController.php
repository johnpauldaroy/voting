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
use Illuminate\Support\Facades\DB;
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

            fputcsv($handle, ['NAME', 'BRANCH', 'EMAIL', 'VOTER ID', 'VOTER KEY', 'IS ACTIVE', 'PASSWORD']);
            fputcsv($handle, ['Grace Ann', 'Main Office', 'grace@voting.local', 'grace', '1234', '1', 'Password@123']);
            fputcsv($handle, ['jp', 'North Branch', 'jp@voting.local', 'jp', '1234', '1', 'Password@123']);

            fclose($handle);
        }, 'voter_import_template.csv', ['Content-Type' => 'text/csv']);
    }

    public function importVoters(Request $request): JsonResponse
    {
        if (! $request->user()->isSuperAdmin() && ! $request->user()->isElectionAdmin()) {
            return response()->json([
                'message' => 'Forbidden.',
            ], 403);
        }

        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        /** @var UploadedFile $file */
        $file = $request->file('file');
        $rows = $this->readCsvFile($file);

        if (count($rows) < 2) {
            return response()->json([
                'message' => 'The CSV file must include a header row and at least one voter row.',
            ], 422);
        }

        $headers = array_map(
            fn ($header): string => Str::snake(trim((string) preg_replace('/^\xEF\xBB\xBF/', '', (string) $header))),
            $rows[0]
        );

        if (! in_array('name', $headers, true) || ! in_array('email', $headers, true)) {
            return response()->json([
                'message' => 'CSV must contain NAME and EMAIL columns.',
            ], 422);
        }

        $payloads = [];
        $errors = [];
        $seenEmails = [];
        $seenVoterIds = [];

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

            $normalized = [
                'name' => $row['name'] ?? null,
                'branch' => $row['branch'] ?: null,
                'email' => isset($row['email']) ? strtolower((string) $row['email']) : null,
                'voter_id' => $row['voter_id'] ?: null,
                'voter_key' => $row['voter_key'] ?: null,
                'password' => $row['password'] ?: null,
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
                'email' => ['required', 'email', 'max:255'],
                'voter_id' => ['nullable', 'string', 'max:100'],
                'voter_key' => ['nullable', 'string', 'max:255'],
                'password' => ['nullable', 'string', 'min:8', 'max:255'],
                'is_active' => ['required', 'boolean'],
            ]);

            if ($validator->fails()) {
                $errors[] = [
                    'line' => $line,
                    'message' => $validator->errors()->first(),
                ];

                continue;
            }

            if (in_array($normalized['email'], $seenEmails, true)) {
                $errors[] = [
                    'line' => $line,
                    'message' => 'Duplicate email found within the CSV file.',
                ];

                continue;
            }

            $seenEmails[] = $normalized['email'];

            if ($normalized['voter_id']) {
                if (in_array($normalized['voter_id'], $seenVoterIds, true)) {
                    $errors[] = [
                        'line' => $line,
                        'message' => 'Duplicate voter_id found within the CSV file.',
                    ];

                    continue;
                }

                $seenVoterIds[] = $normalized['voter_id'];
            }

            $existingUser = User::query()->where('email', $normalized['email'])->first();

            if ($existingUser && ! $existingUser->isVoter()) {
                $errors[] = [
                    'line' => $line,
                    'message' => 'This email belongs to a non-voter account and cannot be imported as voter.',
                ];

                continue;
            }

            if ($normalized['voter_id']) {
                $conflict = User::query()
                    ->where('voter_id', $normalized['voter_id'])
                    ->where('email', '!=', $normalized['email'])
                    ->exists();

                if ($conflict) {
                    $errors[] = [
                        'line' => $line,
                        'message' => 'VOTER ID already exists for a different user.',
                    ];

                    continue;
                }
            }

            $payloads[] = $normalized;
        }

        if (count($errors) > 0) {
            return response()->json([
                'message' => 'Import failed due to CSV validation errors.',
                'errors' => $errors,
            ], 422);
        }

        $created = 0;
        $updated = 0;

        DB::transaction(function () use ($payloads, &$created, &$updated): void {
            foreach ($payloads as $payload) {
                $existingUser = User::query()->where('email', $payload['email'])->first();

                $attributes = [
                    'name' => $payload['name'],
                    'branch' => $payload['branch'],
                    'voter_id' => $payload['voter_id'],
                    'voter_key' => $payload['voter_key'],
                    'role' => 'voter',
                    'is_active' => (bool) $payload['is_active'],
                ];

                if ($payload['password']) {
                    $attributes['password'] = $payload['password'];
                } elseif (! $existingUser) {
                    $attributes['password'] = 'Password@123';
                }

                if ($existingUser) {
                    $existingUser->fill($attributes);
                    $existingUser->save();
                    $user = $existingUser;
                    $updated++;
                } else {
                    $user = User::create([
                        ...$attributes,
                        'email' => $payload['email'],
                    ]);
                    $created++;
                }

                if (! $user->voter_id) {
                    $user->voter_id = $this->generateUniqueVoterId($user->name, $user->id);
                    $user->save();
                }

                if (! $user->voter_key) {
                    $user->voter_key = str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
                    $user->save();
                }
            }
        });

        AuditLogger::log(
            $request,
            'voter.import',
            "Voter import completed. Created: {$created}, Updated: {$updated}, Processed: ".count($payloads).'.'
        );

        return response()->json([
            'message' => 'Voters imported successfully.',
            'meta' => [
                'created' => $created,
                'updated' => $updated,
                'total_processed' => count($payloads),
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

            fputcsv($handle, ['VOTED?', 'NAME', 'BRANCH', 'VOTER ID', 'VOTER KEY', 'EMAIL', 'STATUS']);

            foreach ($voters as $voter) {
                fputcsv($handle, [
                    $voter->has_voted ? 'YES' : 'NO',
                    $voter->name,
                    $voter->branch,
                    $voter->voter_id,
                    $voter->voter_key,
                    $voter->email,
                    $voter->is_active ? 'ACTIVE' : 'INACTIVE',
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
        $base = Str::of($name)->lower()->replaceMatches('/[^a-z0-9]/', '')->value();

        if ($base === '') {
            $base = 'voter'.$userId;
        }

        $candidate = $base;
        $counter = 1;

        while (User::query()->where('voter_id', $candidate)->where('id', '!=', $userId)->exists()) {
            $candidate = $base.$counter;
            $counter++;
        }

        return $candidate;
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
}
