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
        Schema::create('candidates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('election_id')
                ->constrained('elections')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
            $table->foreignId('position_id')
                ->constrained('positions')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
            $table->string('name');
            $table->string('photo_path')->nullable();
            $table->text('bio')->nullable();
            $table->timestamps();

            $table->unique(['position_id', 'name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('candidates');
    }
};
