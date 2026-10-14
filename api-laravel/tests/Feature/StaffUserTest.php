<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StaffUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_cannot_list_staff(): void
    {
        $this->getJson('/api/staff-users')->assertUnauthorized();
    }

    public function test_staff_cannot_list_staff_directory(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));

        $this->getJson('/api/staff-users')->assertForbidden();
    }

    public function test_admin_receives_only_staff_and_necessary_fields(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $staff = User::factory()->create(['role' => 'staff']);
        Sanctum::actingAs($admin);

        $this->getJson('/api/staff-users')->assertOk()->assertExactJson([
            'data' => [['id' => $staff->id, 'name' => $staff->name, 'email' => $staff->email]],
        ]);
    }
}
