<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Candidate\StoreCandidateRequest;
use App\Http\Requests\Candidate\UpdateCandidateRequest;
use App\Http\Resources\CandidateResource;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\Position;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CandidateController extends Controller
{
    public function store(StoreCandidateRequest $request, Election $election): JsonResponse
    {
        $this->authorize('create', [Candidate::class, $election]);

        if ($election->isClosed()) {
            return response()->json([
                'message' => 'Cannot add candidates to a closed election.',
            ], 422);
        }

        $data = $request->validated();
        $photoPath = $data['photo_path'] ?? null;

        if ($request->hasFile('photo')) {
            $photoPath = $request->file('photo')->store('candidates', 'public');
        }

        $position = Position::query()
            ->where('id', $data['position_id'])
            ->where('election_id', $election->id)
            ->first();

        if (! $position) {
            return response()->json([
                'message' => 'Position does not belong to this election.',
            ], 422);
        }

        $candidate = Candidate::create([
            'election_id' => $election->id,
            'position_id' => $data['position_id'],
            'name' => $data['name'],
            'photo_path' => $photoPath,
            'bio' => $data['bio'] ?? null,
        ]);

        AuditLogger::log(
            $request,
            'candidate.create',
            "Candidate #{$candidate->id} created for election #{$election->id}."
        );

        $candidate->loadCount('votes');

        return response()->json([
            'data' => new CandidateResource($candidate),
        ], 201);
    }

    public function update(UpdateCandidateRequest $request, Election $election, Candidate $candidate): JsonResponse
    {
        if ($candidate->election_id !== $election->id) {
            return response()->json([
                'message' => 'Candidate does not belong to this election.',
            ], 404);
        }

        $this->authorize('update', $candidate);

        if ($election->isClosed()) {
            return response()->json([
                'message' => 'Cannot edit candidates in a closed election.',
            ], 422);
        }

        $data = $request->validated();

        if (isset($data['position_id'])) {
            $position = Position::query()
                ->where('id', $data['position_id'])
                ->where('election_id', $election->id)
                ->first();

            if (! $position) {
                return response()->json([
                    'message' => 'Position does not belong to this election.',
                ], 422);
            }

        }

        $payload = [];

        if (array_key_exists('position_id', $data)) {
            $payload['position_id'] = $data['position_id'];
        }

        if (array_key_exists('name', $data)) {
            $payload['name'] = $data['name'];
        }

        if (array_key_exists('bio', $data)) {
            $payload['bio'] = $data['bio'];
        }

        if ($request->hasFile('photo')) {
            $this->deleteStoredPhotoIfPresent($candidate->photo_path);
            $payload['photo_path'] = $request->file('photo')->store('candidates', 'public');
        } elseif (array_key_exists('photo_path', $data)) {
            $this->deleteStoredPhotoIfPresent($candidate->photo_path);
            $payload['photo_path'] = $data['photo_path'];
        }

        if ($payload !== []) {
            $candidate->update($payload);
        }

        AuditLogger::log(
            $request,
            'candidate.update',
            "Candidate #{$candidate->id} updated for election #{$election->id}."
        );

        $candidate->refresh()->loadCount('votes');

        return response()->json([
            'data' => new CandidateResource($candidate),
        ]);
    }

    public function destroy(Request $request, Election $election, Candidate $candidate): JsonResponse
    {
        if ($candidate->election_id !== $election->id) {
            return response()->json([
                'message' => 'Candidate does not belong to this election.',
            ], 404);
        }

        $this->authorize('delete', $candidate);

        if ($election->isClosed()) {
            return response()->json([
                'message' => 'Cannot delete candidates from a closed election.',
            ], 422);
        }

        if ($candidate->votes()->exists()) {
            return response()->json([
                'message' => 'Cannot delete candidate with recorded votes.',
            ], 422);
        }

        $candidateId = $candidate->id;
        $this->deleteStoredPhotoIfPresent($candidate->photo_path);
        $candidate->delete();

        AuditLogger::log(
            $request,
            'candidate.delete',
            "Candidate #{$candidateId} deleted from election #{$election->id}."
        );

        return response()->json([
            'message' => 'Candidate deleted successfully.',
        ]);
    }

    private function deleteStoredPhotoIfPresent(?string $photoPath): void
    {
        if (! is_string($photoPath) || trim($photoPath) === '') {
            return;
        }

        if (str_starts_with($photoPath, 'http://')
            || str_starts_with($photoPath, 'https://')
            || str_starts_with($photoPath, 'data:')
            || str_starts_with($photoPath, 'blob:')) {
            return;
        }

        $normalizedPath = ltrim($photoPath, '/');

        if (str_starts_with($normalizedPath, 'storage/')) {
            $normalizedPath = substr($normalizedPath, 8);
        }

        if ($normalizedPath !== '') {
            Storage::disk('public')->delete($normalizedPath);
        }
    }
}
