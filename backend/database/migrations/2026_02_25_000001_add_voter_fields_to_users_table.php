<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('voter_id')->nullable()->unique()->after('email');
            $table->string('voter_key')->nullable()->after('voter_id');
        });

        $voters = DB::table('users')
            ->where('role', 'voter')
            ->select(['id'])
            ->orderBy('id')
            ->get();

        foreach ($voters as $voter) {
            DB::table('users')
                ->where('id', $voter->id)
                ->update([
                    'voter_id' => sprintf('voter-%04d', (int) $voter->id),
                    'voter_key' => str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT),
                ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['voter_id']);
            $table->dropColumn(['voter_id', 'voter_key']);
        });
    }
};
