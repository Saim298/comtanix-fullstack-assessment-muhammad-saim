<?php

namespace Database\Seeders;


use Illuminate\Database\Seeder;
use App\Models\User;
use RuntimeException;

class StaffUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $accounts = [
            [
                'name' => 'Assessment Admin',
                'email' => 'admin@comtanix.test',
                'role' => 'admin',
                'password' => config('assessment.admin_password'),
            ],
            [
                'name' => 'Staff One',
                'email' => 'staff1@comtanix.test',
                'role' => 'staff',
                'password' => config('assessment.staff_one_password'),
            ],
            [
                'name' => 'Staff Two',
                'email' => 'staff2@comtanix.test',
                'role' => 'staff',
                'password' => config('assessment.staff_two_password'),
            ],
        ];

        foreach ($accounts as $account) {
            if (!is_string($account['password']) || strlen($account['password']) < 12) {
                throw new RuntimeException('Invalid assessment seed password.');
            }
        }

        foreach ($accounts as $account) {
            $user = User::firstOrNew([
                'email' => $account['email'],
            ]);

            $user->name = $account['name'];
            $user->role = $account['role'];

            if (!$user->exists) {
                $user->password = $account['password'];
            }

            $user->save();
        }
    }
}
