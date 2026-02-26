<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Position extends Model
{
    use HasFactory;

    protected $fillable = [
        'election_id',
        'title',
        'min_votes_allowed',
        'max_votes_allowed',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'min_votes_allowed' => 'integer',
            'max_votes_allowed' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function election(): BelongsTo
    {
        return $this->belongsTo(Election::class);
    }

    public function candidates(): HasMany
    {
        return $this->hasMany(Candidate::class);
    }

    public function votes(): HasMany
    {
        return $this->hasMany(Vote::class);
    }
}
