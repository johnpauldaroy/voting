<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Election;
use App\Models\User;

class ElectionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active;
    }

    public function view(User $user, Election $election): bool
    {
        if (! $user->is_active) {
            return false;
        }

        return match ($user->role) {
            UserRole::SUPER_ADMIN->value => true,
            UserRole::ELECTION_ADMIN->value => $election->created_by === $user->id,
            UserRole::VOTER->value => true,
            default => false,
        };
    }

    public function create(User $user): bool
    {
        if (! $user->is_active) {
            return false;
        }

        return in_array($user->role, [
            UserRole::SUPER_ADMIN->value,
            UserRole::ELECTION_ADMIN->value,
        ], true);
    }

    public function update(User $user, Election $election): bool
    {
        if (! $user->is_active) {
            return false;
        }

        // While an election is open/ongoing, only super admins can modify it.
        if ($election->isOpen() && $user->role !== UserRole::SUPER_ADMIN->value) {
            return false;
        }

        if ($user->role === UserRole::SUPER_ADMIN->value) {
            return true;
        }

        return $user->role === UserRole::ELECTION_ADMIN->value
            && $election->created_by === $user->id;
    }

    public function delete(User $user, Election $election): bool
    {
        if (! $user->is_active) {
            return false;
        }

        if ($user->role === UserRole::SUPER_ADMIN->value) {
            return true;
        }

        if ($election->isClosed()) {
            return false;
        }

        return $user->role === UserRole::ELECTION_ADMIN->value
            && $election->created_by === $user->id;
    }

    public function manage(User $user, Election $election): bool
    {
        return $this->update($user, $election);
    }

    public function viewResults(User $user, Election $election): bool
    {
        if (! $this->view($user, $election)) {
            return false;
        }

        if (in_array($user->role, [UserRole::SUPER_ADMIN->value, UserRole::ELECTION_ADMIN->value], true)) {
            return true;
        }

        if ($election->isClosed()) {
            return true;
        }

        return (bool) config('voting.allow_results_before_close', false);
    }
}
