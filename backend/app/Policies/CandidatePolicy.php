<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\User;

class CandidatePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active;
    }

    public function view(User $user, Candidate $candidate): bool
    {
        return $user->is_active;
    }

    public function create(User $user, Election $election): bool
    {
        if (! $user->is_active || $election->isClosed()) {
            return false;
        }

        if ($election->isOpen() && $user->role !== UserRole::SUPER_ADMIN->value) {
            return false;
        }

        if ($user->role === UserRole::SUPER_ADMIN->value) {
            return true;
        }

        return $user->role === UserRole::ELECTION_ADMIN->value
            && $election->created_by === $user->id;
    }

    public function update(User $user, Candidate $candidate): bool
    {
        if (! $user->is_active || $candidate->election->isClosed()) {
            return false;
        }

        if ($candidate->election->isOpen() && $user->role !== UserRole::SUPER_ADMIN->value) {
            return false;
        }

        if ($user->role === UserRole::SUPER_ADMIN->value) {
            return true;
        }

        return $user->role === UserRole::ELECTION_ADMIN->value
            && $candidate->election->created_by === $user->id;
    }

    public function delete(User $user, Candidate $candidate): bool
    {
        return $this->update($user, $candidate);
    }
}
