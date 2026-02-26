<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CandidateResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $photoPath = $this->photo_path;

        if (is_string($photoPath) && $photoPath !== '') {
            $isAbsolute = str_starts_with($photoPath, 'http://')
                || str_starts_with($photoPath, 'https://')
                || str_starts_with($photoPath, 'data:')
                || str_starts_with($photoPath, 'blob:');

            if (! $isAbsolute) {
                $normalized = ltrim($photoPath, '/');

                if (str_starts_with($normalized, 'storage/')) {
                    $photoPath = '/'.$normalized;
                } else {
                    $photoPath = '/storage/'.$normalized;
                }
            }
        }

        return [
            'id' => $this->id,
            'election_id' => $this->election_id,
            'position_id' => $this->position_id,
            'name' => $this->name,
            'photo_path' => $photoPath,
            'bio' => $this->bio,
            'votes_count' => $this->whenCounted('votes'),
            'created_at' => optional($this->created_at)->toIso8601String(),
            'updated_at' => optional($this->updated_at)->toIso8601String(),
        ];
    }
}
