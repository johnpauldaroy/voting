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
        Schema::table('users', function (Blueprint $table): void {
            $table->index(['role', 'name'], 'users_role_name_idx');
            $table->index(['role', 'branch', 'name'], 'users_role_branch_name_idx');
            $table->index(['role', 'created_at'], 'users_role_created_at_idx');
        });

        Schema::table('attendances', function (Blueprint $table): void {
            $table->index(['election_id', 'status', 'user_id'], 'attendances_election_status_user_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table): void {
            $table->dropIndex('attendances_election_status_user_idx');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex('users_role_created_at_idx');
            $table->dropIndex('users_role_branch_name_idx');
            $table->dropIndex('users_role_name_idx');
        });
    }
};

