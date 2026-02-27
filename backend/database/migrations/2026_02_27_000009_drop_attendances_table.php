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
        Schema::dropIfExists('attendances');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('election_id')
                ->constrained('elections')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
            $table->enum('status', ['present', 'absent'])->default('absent');
            $table->timestamp('checked_in_at')->nullable();
            $table->string('source', 20)->default('manual');
            $table->timestamps();

            $table->unique(['election_id', 'user_id']);
            $table->index(['election_id', 'status']);
        });
    }
};
