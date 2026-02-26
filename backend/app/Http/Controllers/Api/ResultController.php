<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\ElectionResultResource;
use App\Models\Election;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ResultController extends Controller
{
    public function show(Election $election): JsonResponse
    {
        $this->authorize('viewResults', $election);

        return response()->json([
            'data' => new ElectionResultResource($this->buildResultsPayload($election)),
        ]);
    }

    public function exportCsv(Election $election): StreamedResponse
    {
        $this->authorize('viewResults', $election);

        $results = $this->buildResultsPayload($election);

        $fileName = sprintf('election_%d_results.csv', $election->id);

        return response()->streamDownload(function () use ($results): void {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'Election ID',
                'Election Title',
                'Position',
                'Rank',
                'Candidate',
                'Photo Path',
                'Votes',
                'Percentage',
            ]);

            foreach ($results['positions'] as $position) {
                foreach ($position['candidates'] as $index => $candidate) {
                    fputcsv($handle, [
                        $results['id'],
                        $results['title'],
                        $position['title'],
                        $index + 1,
                        $candidate['name'],
                        $candidate['photo_path'],
                        $candidate['votes'],
                        $candidate['percentage'],
                    ]);
                }
            }

            fclose($handle);
        }, $fileName, [
            'Content-Type' => 'text/csv',
        ]);
    }

    private function buildResultsPayload(Election $election): array
    {
        $election->load([
            'positions.candidates' => fn ($query) => $query->withCount('votes'),
        ])->loadCount('votes');

        $votersParticipated = (int) $election->votes()
            ->select('voter_hash')
            ->distinct()
            ->count('voter_hash');

        $totalVoters = (int) User::query()
            ->where('role', UserRole::VOTER->value)
            ->where('is_active', true)
            ->count();

        $voterTurnoutPercentage = $totalVoters > 0
            ? round(($votersParticipated / $totalVoters) * 100, 2)
            : 0.0;

        $positions = $election->positions->map(function ($position): array {
            $positionTotal = (int) $position->candidates->sum('votes_count');

            return [
                'id' => $position->id,
                'title' => $position->title,
                'total_votes' => $positionTotal,
                'candidates' => $position->candidates
                    ->map(fn ($candidate): array => [
                        'id' => $candidate->id,
                        'name' => $candidate->name,
                        'photo_path' => $candidate->photo_path,
                        'votes' => (int) $candidate->votes_count,
                        'percentage' => $positionTotal > 0
                            ? round(((int) $candidate->votes_count / $positionTotal) * 100, 2)
                            : 0.0,
                    ])
                    ->sortByDesc('votes')
                    ->values()
                    ->all(),
            ];
        })->values()->all();

        return [
            'id' => $election->id,
            'title' => $election->title,
            'status' => $election->status,
            'start_datetime' => optional($election->start_datetime)->toIso8601String(),
            'end_datetime' => optional($election->end_datetime)->toIso8601String(),
            'total_votes' => (int) $election->votes_count,
            'voters_participated' => $votersParticipated,
            'total_voters' => $totalVoters,
            'voter_turnout_percentage' => $voterTurnoutPercentage,
            'positions' => $positions,
        ];
    }
}
