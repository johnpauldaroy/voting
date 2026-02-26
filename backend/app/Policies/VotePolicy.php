<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Election;
use App\Models\User;
use App\Models\Vote;

class VotePolicy
{
    public function viewAny(User $user): bool
    {
        return false;
    }

    public function view(User $user, Vote $vote): bool
    {
        return false;
    }

    public function create(User $user, Election $election): bool
    {
        return $user->is_active
            && $user->role === UserRole::VOTER->value
            && $election->isOpen()
            && ! $election->hasEnded();
    }

    public function update(User $user, Vote $vote): bool
    {
        return false;
    }

    public function delete(User $user, Vote $vote): bool
    {
        return false;
    }
}
