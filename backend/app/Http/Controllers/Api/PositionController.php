<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Position\ReorderPositionsRequest;
use App\Http\Requests\Position\StorePositionRequest;
use App\Http\Resources\PositionResource;
use App\Models\Election;
use App\Models\Position;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class PositionController extends Controller
{
    public function store(StorePositionRequest $request, Election $election): JsonResponse
    {
        $this->authorize('manage', $election);

        if ($election->isClosed()) {
            return response()->json([
                'message' => 'Cannot add positions to a closed election.',
            ], 422);
        }

        $nextSortOrder = ((int) Position::query()
            ->where('election_id', $election->id)
            ->max('sort_order')) + 1;

        $position = Position::create([
            ...$request->validated(),
            'election_id' => $election->id,
            'sort_order' => $nextSortOrder,
        ]);

        AuditLogger::log(
            $request,
            'position.create',
            "Position #{$position->id} created for election #{$election->id}."
        );

        $position->load('candidates')->loadCount('votes');

        return response()->json([
            'data' => new PositionResource($position),
        ], 201);
    }

    public function reorder(ReorderPositionsRequest $request, Election $election): JsonResponse
    {
        $this->authorize('manage', $election);

        if ($election->isClosed()) {
            return response()->json([
                'message' => 'Cannot reorder positions for a closed election.',
            ], 422);
        }

        $orderedPositionIds = array_map('intval', $request->validated('positions'));

        $currentPositionIds = $election->positions()
            ->select('id')
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        sort($orderedPositionIds);
        $sortedCurrentPositionIds = $currentPositionIds;
        sort($sortedCurrentPositionIds);

        if ($orderedPositionIds !== $sortedCurrentPositionIds) {
            return response()->json([
                'message' => 'Position order payload must include every position in the election exactly once.',
            ], 422);
        }

        $finalOrderIds = array_map('intval', $request->validated('positions'));

        DB::transaction(function () use ($election, $finalOrderIds): void {
            foreach ($finalOrderIds as $index => $positionId) {
                Position::query()
                    ->where('election_id', $election->id)
                    ->where('id', $positionId)
                    ->update([
                        'sort_order' => $index + 1,
                    ]);
            }
        });

        AuditLogger::log(
            $request,
            'position.reorder',
            "Positions reordered for election #{$election->id}."
        );

        $positions = $election->positions()
            ->with('candidates')
            ->withCount('votes')
            ->get();

        return response()->json([
            'data' => PositionResource::collection($positions),
        ]);
    }
}
