<?php

namespace Database\Factories;

use App\Models\QuoteRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<QuoteRequest>
 */
class QuoteRequestFactory extends Factory
{
    protected $model = QuoteRequest::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'client_name' => fake()->name(),
            'email' => fake()->safeEmail(),
            'company' => fake()->optional(0.8)->company(),
            'service_type' => fake()->randomElement([
                'Web Development',
                'Mobile Development',
                'UI/UX Design',
                'API Development',
                'Cloud Services',
            ]),
            'budget_range' => fake()->randomElement([
                'under_1000',
                '1000_5000',
                '5000_10000',
                'above_10000',
                'not_sure',
            ]),
            'message' => fake()->paragraph(3),
            'status' => 'new',
            'assigned_user_id' => null,
        ];
    }
}
