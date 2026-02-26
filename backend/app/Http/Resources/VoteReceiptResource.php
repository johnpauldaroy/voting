<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VoteReceiptResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'election_id' => $this['election_id'],
            'positions_voted' => $this['positions_voted'],
            'submitted_at' => $this['submitted_at'],
            'message' => $this['message'],
        ];
    }
}
