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
        Schema::table('positions', function (Blueprint $table) {
            $table->unsignedInteger('min_votes_allowed')->default(1)->after('title');
        });

        DB::table('positions')
            ->whereColumn('max_votes_allowed', '<', 'min_votes_allowed')
            ->update([
                'max_votes_allowed' => DB::raw('min_votes_allowed'),
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('positions', function (Blueprint $table) {
            $table->dropColumn('min_votes_allowed');
        });
    }
};
