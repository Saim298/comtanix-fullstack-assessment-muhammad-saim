<?php

namespace Database\Seeders;

use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class QuoteRequestSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $staffIds = User::query()
            ->where('role', 'staff')
            ->pluck('id')
            ->all();

        if (count($staffIds) < 2) {
            throw new RuntimeException('Seed the staff users before quote requests.');
        }

        $existingCount = QuoteRequest::withTrashed()->count();
        $remaining = max(0, 200 - $existingCount);

        if ($remaining === 0) {
            return;
        }

        QuoteRequest::factory()
            ->count($remaining)
            ->state(function () use ($staffIds): array {
                $status = fake()->randomElement([
                    'new',
                    'in_review',
                    'quoted',
                    'closed',
                ]);

                return [
                    'status' => $status,
                    'assigned_user_id' => $status === 'new' && fake()->boolean(50)
                        ? null
                        : fake()->randomElement($staffIds),
                ];
            })
            ->create();
    }
}
