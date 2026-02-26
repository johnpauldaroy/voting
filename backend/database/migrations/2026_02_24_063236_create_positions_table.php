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
        Schema::create('positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('election_id')
                ->constrained('elections')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
            $table->string('title');
            $table->unsignedInteger('max_votes_allowed')->default(1);
            $table->timestamps();

            $table->unique(['election_id', 'title']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('positions');
    }
};
