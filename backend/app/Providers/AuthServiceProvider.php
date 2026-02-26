<?php

namespace App\Providers;

use App\Models\Candidate;
use App\Models\Election;
use App\Models\Vote;
use App\Policies\CandidatePolicy;
use App\Policies\ElectionPolicy;
use App\Policies\VotePolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::policy(Election::class, ElectionPolicy::class);
        Gate::policy(Vote::class, VotePolicy::class);
        Gate::policy(Candidate::class, CandidatePolicy::class);
    }
}
