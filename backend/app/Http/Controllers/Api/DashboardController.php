<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\Position;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();

        $electionsQuery = Election::query();

        if ($user->isElectionAdmin()) {
            $electionsQuery->where('created_by', $user->id);
        }

        $electionIds = $electionsQuery->pluck('id');

        $todayStart = now()->startOfDay();
        $todayEnd = now()->endOfDay();

        $hourlyBuckets = [];
        for ($hour = 0; $hour < 24; $hour++) {
            $label = sprintf('%02d:00', $hour);
            $hourlyBuckets[$label] = 0;
        }

        $totalVotersVotedToday = 0;
        $votersParticipatedToday = 0;
        $totalPositions = 0;
        $totalCandidates = 0;

        if ($electionIds->isNotEmpty()) {
            $votesQuery = Vote::query()->whereIn('election_id', $electionIds->all());

            $votesToday = (clone $votesQuery)
                ->whereBetween('created_at', [$todayStart, $todayEnd])
                ->get(['created_at', 'voter_hash']);

            $uniqueVotersToday = [];
            $voterHashesByHour = [];

            foreach ($votesToday as $vote) {
                $voterHash = (string) $vote->voter_hash;
                if ($voterHash === '') {
                    continue;
                }

                $uniqueVotersToday[$voterHash] = true;

                $hourLabel = optional($vote->created_at)->format('H:00');
                if ($hourLabel === null || ! array_key_exists($hourLabel, $hourlyBuckets)) {
                    continue;
                }

                $voterHashesByHour[$hourLabel] ??= [];
                $voterHashesByHour[$hourLabel][$voterHash] = true;
            }

            foreach ($voterHashesByHour as $hourLabel => $voterHashes) {
                $hourlyBuckets[$hourLabel] = count($voterHashes);
            }

            $totalVotersVotedToday = count($uniqueVotersToday);
            $votersParticipatedToday = $totalVotersVotedToday;

            $totalPositions = Position::query()
                ->whereIn('election_id', $electionIds->all())
                ->count();

            $totalCandidates = Candidate::query()
                ->whereIn('election_id', $electionIds->all())
                ->count();
        }

        $totalVoters = User::query()
            ->where('role', UserRole::VOTER->value)
            ->where('is_active', true)
            ->count();

        $participationPercentageToday = $totalVoters > 0
            ? round(($votersParticipatedToday / $totalVoters) * 100, 2)
            : 0.0;

        $votesPerHour = collect($hourlyBuckets)
            ->map(fn ($votes, $hour): array => [
                'hour' => $hour,
                'votes' => $votes,
            ])
            ->values()
            ->all();

        return response()->json([
            'data' => [
                'time_range' => [
                    'date' => $todayStart->toDateString(),
                    'start' => $todayStart->toIso8601String(),
                    'end' => $todayEnd->toIso8601String(),
                ],
                'total_votes_today' => $totalVotersVotedToday,
                'total_voters_voted_today' => $totalVotersVotedToday,
                'total_voters' => $totalVoters,
                'voters_participated_today' => $votersParticipatedToday,
                'participation_percentage_today' => $participationPercentageToday,
                'total_positions' => $totalPositions,
                'total_candidates' => $totalCandidates,
                'votes_per_hour' => $votesPerHour,
            ],
        ]);
    }
}
