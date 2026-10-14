<?php

namespace Tests\Feature;

use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QuoteManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_quotes(): void
    {
        $this->getJson('/api/quote-requests')
            ->assertUnauthorized();
    }

    public function test_staff_can_list_quotes_with_filters(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);

        QuoteRequest::factory()->create(['status' => 'new']);
        QuoteRequest::factory()->create(['status' => 'quoted']);

        Sanctum::actingAs($staff);

        $this->getJson('/api/quote-requests?status=new&per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.status', 'new');
    }

    public function test_admin_can_assign_quote_to_staff(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $staff = User::factory()->create(['role' => 'staff']);
        $quote = QuoteRequest::factory()->create();

        Sanctum::actingAs($admin);

        $this->patchJson("/api/quote-requests/{$quote->id}/assign", [
            'assigned_user_id' => $staff->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.assigned_user_id', $staff->id);

        $this->assertDatabaseHas('quote_requests', [
            'id' => $quote->id,
            'assigned_user_id' => $staff->id,
        ]);
    }

    public function test_staff_cannot_assign_quotes(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);
        $otherStaff = User::factory()->create(['role' => 'staff']);
        $quote = QuoteRequest::factory()->create();

        Sanctum::actingAs($staff);

        $this->patchJson("/api/quote-requests/{$quote->id}/assign", [
            'assigned_user_id' => $otherStaff->id,
        ])->assertForbidden();
    }

    public function test_admin_cannot_assign_quote_to_an_admin(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $quote = QuoteRequest::factory()->create();

        Sanctum::actingAs($admin);

        $this->patchJson("/api/quote-requests/{$quote->id}/assign", [
            'assigned_user_id' => $admin->id,
        ])->assertUnprocessable();
    }

    public function test_assigned_staff_can_update_quote_status(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);

        $quote = QuoteRequest::factory()->create([
            'assigned_user_id' => $staff->id,
            'status' => 'new',
        ]);

        Sanctum::actingAs($staff);

        $this->patchJson("/api/quote-requests/{$quote->id}/status", [
            'status' => 'in_review',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'in_review');
    }

    public function test_unassigned_staff_cannot_update_quote_status(): void
    {
        $staffOne = User::factory()->create(['role' => 'staff']);
        $staffTwo = User::factory()->create(['role' => 'staff']);

        $quote = QuoteRequest::factory()->create([
            'assigned_user_id' => $staffOne->id,
        ]);

        Sanctum::actingAs($staffTwo);

        $this->patchJson("/api/quote-requests/{$quote->id}/status", [
            'status' => 'in_review',
        ])->assertForbidden();
    }

    public function test_invalid_status_transition_is_rejected(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $quote = QuoteRequest::factory()->create([
            'status' => 'new',
        ]);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/quote-requests/{$quote->id}/status", [
            'status' => 'quoted',
        ])->assertUnprocessable();

        $this->assertDatabaseHas('quote_requests', [
            'id' => $quote->id,
            'status' => 'new',
        ]);
    }

    public function test_staff_cannot_delete_quote(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);
        $quote = QuoteRequest::factory()->create();

        Sanctum::actingAs($staff);

        $this->deleteJson("/api/quote-requests/{$quote->id}")
            ->assertForbidden();
    }

    public function test_admin_can_soft_delete_quote(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $quote = QuoteRequest::factory()->create();

        Sanctum::actingAs($admin);

        $this->deleteJson("/api/quote-requests/{$quote->id}")
            ->assertNoContent();

        $this->assertSoftDeleted('quote_requests', [
            'id' => $quote->id,
        ]);
    }

}
