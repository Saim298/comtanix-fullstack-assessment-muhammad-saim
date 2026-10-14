<?php

namespace Tests\Feature;

use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QuoteListTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_and_staff_can_filter_by_assignee_without_accessing_the_staff_directory(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $staff = User::factory()->create(['role' => 'staff']);
        $otherStaff = User::factory()->create(['role' => 'staff']);
        $assigned = QuoteRequest::factory()->create(['assigned_user_id' => $otherStaff->id]);
        QuoteRequest::factory()->create(['assigned_user_id' => $staff->id]);
        QuoteRequest::factory()->create();

        foreach ([$admin, $staff] as $user) {
            Sanctum::actingAs($user);
            $this->getJson("/api/quote-requests?assigned_user_id={$otherStaff->id}")
                ->assertOk()
                ->assertJsonPath('meta.total', 1)
                ->assertJsonPath('data.0.id', $assigned->id);
        }

        $this->getJson('/api/staff-users')->assertForbidden();
        $this->patchJson("/api/quote-requests/{$assigned->id}/status", ['status' => 'in_review'])->assertForbidden();
    }

    public function test_unassigned_combines_with_search_status_and_service_filters_for_both_roles(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);
        $attributes = ['client_name' => 'Client 0', 'service_type' => 'API', 'status' => 'new'];
        $match = QuoteRequest::factory()->create($attributes);
        QuoteRequest::factory()->create([...$attributes, 'assigned_user_id' => $staff->id]);
        QuoteRequest::factory()->create([...$attributes, 'status' => 'closed']);
        QuoteRequest::factory()->create([...$attributes, 'service_type' => 'Web']);
        QuoteRequest::factory()->create([...$attributes, 'client_name' => 'Other', 'email' => 'other@example.test', 'company' => 'Other']);

        foreach (['admin', 'staff'] as $role) {
            Sanctum::actingAs(User::factory()->create(['role' => $role]));
            $this->getJson('/api/quote-requests?unassigned=1&search=Client%200&service_type=API&status=new')
                ->assertOk()
                ->assertJsonPath('meta.total', 1)
                ->assertJsonPath('data.0.id', $match->id)
                ->assertJsonPath('data.0.assigned_user_id', null);
        }

        $this->getJson('/api/quote-requests?unassigned=0')->assertOk()->assertJsonPath('meta.total', 5);
    }

    public function test_date_sorting_happens_before_pagination_with_stable_ties(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $oldest = QuoteRequest::factory()->create(['created_at' => '2026-01-01 12:00:00']);
        $middle = QuoteRequest::factory()->create(['created_at' => '2026-02-01 12:00:00']);
        $newest = QuoteRequest::factory()->create(['created_at' => '2026-03-01 12:00:00']);
        $tie = QuoteRequest::factory()->create(['created_at' => '2026-03-01 12:00:00']);

        foreach (['asc' => [$oldest, $middle, $tie, $newest], 'desc' => [$tie, $newest, $middle, $oldest]] as $direction => $expected) {
            foreach ($expected as $index => $quote) {
                $page = $index + 1;
                $this->getJson("/api/quote-requests?sort_by=created_at&sort_direction={$direction}&per_page=1&page={$page}")
                    ->assertOk()
                    ->assertJsonPath('meta.current_page', $page)
                    ->assertJsonPath('meta.total', 4)
                    ->assertJsonPath('data.0.id', $quote->id);
            }
        }
    }

    public function test_conflicting_or_invalid_assignment_filters_are_rejected(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);
        Sanctum::actingAs($staff);
        $this->getJson("/api/quote-requests?unassigned=1&assigned_user_id={$staff->id}")
            ->assertUnprocessable()->assertJsonValidationErrors('assigned_user_id');
        $this->getJson('/api/quote-requests?unassigned=invalid')
            ->assertUnprocessable()->assertJsonValidationErrors('unassigned');
        $this->getJson('/api/quote-requests?assigned_user_id=999999')
            ->assertUnprocessable()->assertJsonValidationErrors('assigned_user_id');
    }
}
