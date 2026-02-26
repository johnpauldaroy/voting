<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ElectionResultResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this['id'],
            'title' => $this['title'],
            'status' => $this['status'],
            'start_datetime' => $this['start_datetime'],
            'end_datetime' => $this['end_datetime'],
            'total_votes' => $this['total_votes'],
            'voters_participated' => $this['voters_participated'],
            'total_voters' => $this['total_voters'],
            'voter_turnout_percentage' => $this['voter_turnout_percentage'],
            'positions' => $this['positions'],
        ];
    }
}
