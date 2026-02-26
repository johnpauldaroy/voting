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
            $table->unsignedInteger('sort_order')->default(0)->after('max_votes_allowed');
            $table->index(['election_id', 'sort_order']);
        });

        $electionIds = DB::table('positions')
            ->select('election_id')
            ->distinct()
            ->pluck('election_id');

        foreach ($electionIds as $electionId) {
            $positions = DB::table('positions')
                ->where('election_id', $electionId)
                ->orderBy('id')
                ->pluck('id');

            foreach ($positions as $index => $positionId) {
                DB::table('positions')
                    ->where('id', $positionId)
                    ->update(['sort_order' => $index + 1]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('positions', function (Blueprint $table) {
            $table->dropIndex(['election_id', 'sort_order']);
            $table->dropColumn('sort_order');
        });
    }
};
