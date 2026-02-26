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
        Schema::create('votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('election_id')
                ->constrained('elections')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
            $table->foreignId('position_id')
                ->constrained('positions')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
            $table->foreignId('candidate_id')
                ->constrained('candidates')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
            $table->char('voter_hash', 64);
            $table->timestamps();

            $table->unique(['election_id', 'position_id', 'voter_hash'], 'votes_unique_election_position_voter');
            $table->index(['election_id', 'candidate_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('votes');
    }
};
