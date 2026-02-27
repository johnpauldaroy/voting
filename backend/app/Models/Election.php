<?php

namespace App\Models;

use App\Enums\ElectionStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Election extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'start_datetime',
        'end_datetime',
        'status',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'start_datetime' => 'datetime',
            'end_datetime' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function positions(): HasMany
    {
        return $this->hasMany(Position::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function candidates(): HasMany
    {
        return $this->hasMany(Candidate::class);
    }

    public function votes(): HasMany
    {
        return $this->hasMany(Vote::class);
    }

    public function scopeForDashboard(Builder $query): Builder
    {
        return $query->with(['creator:id,name,email', 'positions.candidates'])->withCount('votes');
    }

    public function hasStarted(): bool
    {
        return $this->start_datetime->lte(now());
    }

    public function hasEnded(): bool
    {
        return $this->end_datetime->lt(now());
    }

    public function isOpen(): bool
    {
        return $this->status === ElectionStatus::OPEN->value;
    }

    public function isClosed(): bool
    {
        return $this->status === ElectionStatus::CLOSED->value;
    }

    public function canOpen(): bool
    {
        return ! $this->isClosed() && ! $this->hasEnded();
    }
}
