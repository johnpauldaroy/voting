<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE users MODIFY email VARCHAR(255) NULL');
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->string('email')->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('users')
            ->whereNull('email')
            ->select('id')
            ->orderBy('id')
            ->chunkById(200, function ($users): void {
                foreach ($users as $user) {
                    DB::table('users')
                        ->where('id', $user->id)
                        ->update([
                            'email' => "restored-user-{$user->id}@local.invalid",
                        ]);
                }
            });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE users MODIFY email VARCHAR(255) NOT NULL');
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->string('email')->nullable(false)->change();
        });
    }
};
