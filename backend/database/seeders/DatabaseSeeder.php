<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::query()->updateOrCreate([
            'email' => 'superadmin@voting.local',
        ], [
            'name' => 'Super Admin',
            'password' => Hash::make('Password@123'),
            'role' => UserRole::SUPER_ADMIN->value,
            'is_active' => true,
        ]);

        User::query()->updateOrCreate([
            'email' => 'electionadmin@voting.local',
        ], [
            'name' => 'Election Admin',
            'password' => Hash::make('Password@123'),
            'role' => UserRole::ELECTION_ADMIN->value,
            'is_active' => true,
        ]);

        User::query()->updateOrCreate([
            'email' => 'voter@voting.local',
        ], [
            'name' => 'Representative Voter',
            'voter_id' => 'voter-0001',
            'voter_key' => '1234',
            'password' => Hash::make('Password@123'),
            'role' => UserRole::VOTER->value,
            'is_active' => true,
        ]);

        User::query()->updateOrCreate([
            'email' => 'grace@voting.local',
        ], [
            'name' => 'Grace Ann',
            'voter_id' => 'grace',
            'voter_key' => '1234',
            'password' => Hash::make('Password@123'),
            'role' => UserRole::VOTER->value,
            'is_active' => true,
        ]);

        User::query()->updateOrCreate([
            'email' => 'jp@voting.local',
        ], [
            'name' => 'jp',
            'voter_id' => 'jp',
            'voter_key' => '1234',
            'password' => Hash::make('Password@123'),
            'role' => UserRole::VOTER->value,
            'is_active' => true,
        ]);
    }
}
