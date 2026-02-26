<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('votes', function (Blueprint $table) {
            $table->dropUnique('votes_unique_election_position_voter');
            $table->unique(
                ['election_id', 'position_id', 'candidate_id', 'voter_hash'],
                'votes_unique_election_position_candidate_voter'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('votes', function (Blueprint $table) {
            $table->dropUnique('votes_unique_election_position_candidate_voter');
            $table->unique(['election_id', 'position_id', 'voter_hash'], 'votes_unique_election_position_voter');
        });
    }
};
