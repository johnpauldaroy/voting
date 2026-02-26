<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ElectionResource extends JsonResource
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
            'title' => $this->title,
            'description' => $this->description,
            'start_datetime' => optional($this->start_datetime)->toIso8601String(),
            'end_datetime' => optional($this->end_datetime)->toIso8601String(),
            'status' => $this->status,
            'created_by' => $this->created_by,
            'creator' => $this->whenLoaded('creator', fn () => new UserResource($this->creator)),
            'positions' => PositionResource::collection($this->whenLoaded('positions')),
            'votes_count' => $this->whenCounted('votes'),
            'created_at' => optional($this->created_at)->toIso8601String(),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
        ];
    }
}
