<?php

namespace App\Models;

use DomainException;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Vote extends Model
{
    use HasFactory;

    protected $fillable = [
        'election_id',
        'position_id',
        'candidate_id',
        'voter_hash',
    ];

    protected $hidden = [
        'voter_hash',
    ];

    protected static function booted(): void
    {
        static::updating(function () {
            throw new DomainException('Votes are immutable and cannot be updated.');
        });

        static::deleting(function () {
            throw new DomainException('Votes are immutable and cannot be deleted.');
        });
    }

    public static function voterHash(int $userId, int $electionId): string
    {
        return hash('sha256', "{$userId}|{$electionId}");
    }

    public function election(): BelongsTo
    {
        return $this->belongsTo(Election::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }
}
