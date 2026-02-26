<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PositionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'election_id' => $this->election_id,
            'title' => $this->title,
            'min_votes_allowed' => $this->min_votes_allowed,
            'max_votes_allowed' => $this->max_votes_allowed,
            'sort_order' => $this->sort_order,
            'candidates' => CandidateResource::collection($this->whenLoaded('candidates')),
            'votes_count' => $this->whenCounted('votes'),
            'created_at' => optional($this->created_at)->toIso8601String(),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
        ];
    }
}
