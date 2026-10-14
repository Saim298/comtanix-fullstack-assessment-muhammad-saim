<?php

namespace Tests\Feature;

use App\Jobs\SendAuditEventJob;
use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Illuminate\Support\Facades\Queue;

class QuoteManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_list_quotes(): void
    {
        $this->getJson('/api/quote-requests')
            ->assertUnauthorized();
    }
    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake([SendAuditEventJob::class]);
        Http::preventStrayRequests();
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

        Queue::assertPushed(SendAuditEventJob::class, 1);
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

        Queue::assertNothingPushed();
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

        Queue::assertPushed(SendAuditEventJob::class, 1);
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

        $this->getJson("/api/quote-requests/{$quote->id}")->assertNotFound();
        $this->getJson('/api/quote-requests')->assertJsonPath('meta.total', 0);
    }

    public function test_admin_can_reassign_quote_and_receives_staff_details(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $previousStaff = User::factory()->create(['role' => 'staff']);
        $staff = User::factory()->create(['role' => 'staff']);
        $quote = QuoteRequest::factory()->create(['assigned_user_id' => $previousStaff->id]);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/quote-requests/{$quote->id}/assign", [
            'assigned_user_id' => $staff->id,
        ])->assertOk()->assertJsonPath('data.assigned_user.name', $staff->name);

        Queue::assertPushed(SendAuditEventJob::class, function (SendAuditEventJob $job) use ($previousStaff, $staff) {
            return $job->event['data']['oldAssignedUserId'] === $previousStaff->id
                && $job->event['data']['newAssignedUserId'] === $staff->id;
        });

        Sanctum::actingAs($previousStaff);

        $this->patchJson("/api/quote-requests/{$quote->id}/status", [
            'status' => 'in_review',
        ])->assertForbidden();
    }

    public function test_admin_can_use_all_valid_status_transitions(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        foreach ([['new', 'in_review'], ['in_review', 'quoted'], ['in_review', 'closed'], ['quoted', 'closed']] as [$from, $to]) {
            $quote = QuoteRequest::factory()->create(['status' => $from]);

            $this->patchJson("/api/quote-requests/{$quote->id}/status", [
                'status' => $to,
            ])->assertOk()->assertJsonPath('data.status', $to);

            $this->assertDatabaseHas('quote_requests', ['id' => $quote->id, 'status' => $to]);
        }

        Queue::assertPushed(SendAuditEventJob::class, 4);
    }

    public function test_closed_quote_cannot_transition(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $quote = QuoteRequest::factory()->create(['status' => 'closed']);

        foreach (['new', 'in_review', 'quoted', 'closed'] as $status) {
            $this->patchJson("/api/quote-requests/{$quote->id}/status", [
                'status' => $status,
            ])->assertUnprocessable();
        }

        $this->assertDatabaseHas('quote_requests', ['id' => $quote->id, 'status' => 'closed']);
        Queue::assertNothingPushed();
    }

    public function test_quote_details_require_authentication_and_include_assignee(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);
        $quote = QuoteRequest::factory()->create(['assigned_user_id' => $staff->id]);

        $this->getJson("/api/quote-requests/{$quote->id}")->assertUnauthorized();

        Sanctum::actingAs($staff);

        $this->getJson("/api/quote-requests/{$quote->id}")
            ->assertOk()
            ->assertJsonPath('data.message', $quote->message)
            ->assertJsonPath('data.assigned_user.email', $staff->email);
    }

    public function test_search_service_filter_and_pagination_work_together(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        QuoteRequest::factory()->count(3)->create([
            'client_name' => 'Search Client',
            'service_type' => 'Web Development',
            'status' => 'in_review',
        ]);
        QuoteRequest::factory()->create(['client_name' => 'Other', 'service_type' => 'Design', 'status' => 'new']);

        $first = $this->getJson('/api/quote-requests?search=Search&service_type=Develop&status=in_review&per_page=2&page=1')
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 3)->assertJsonPath('meta.last_page', 2);
        $second = $this->getJson('/api/quote-requests?search=Search&service_type=Develop&status=in_review&per_page=2&page=2')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.current_page', 2);

        $this->assertNotContains($second->json('data.0.id'), array_column($first->json('data'), 'id'));
    }

    public function test_literal_zero_filters_client_name_email_and_company(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $defaults = ['client_name' => 'Client', 'email' => 'client@example.test', 'company' => 'Company'];
        $matches = [];

        foreach (['client_name' => 'Client 0', 'email' => 'client0@example.test', 'company' => 'Company 0'] as $field => $value) {
            $matches[] = QuoteRequest::factory()->create([...$defaults, $field => $value])->id;
        }

        QuoteRequest::factory()->create($defaults);

        $response = $this->getJson('/api/quote-requests?search=0')
            ->assertOk()->assertJsonPath('meta.total', 3)->assertJsonCount(3, 'data');

        $this->assertEqualsCanonicalizing($matches, array_column($response->json('data'), 'id'));
    }

    public function test_literal_zero_filters_service_type(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $match = QuoteRequest::factory()->create(['service_type' => 'Service 0']);
        QuoteRequest::factory()->create(['service_type' => 'Web Development']);

        $this->getJson('/api/quote-requests?service_type=0')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $match->id);
    }

    public function test_service_types_route_is_not_treated_as_a_quote_id(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        QuoteRequest::factory()->count(2)->create(['service_type' => 'Web Development']);

        $this->getJson('/api/quote-requests/service-types')
            ->assertOk()->assertExactJson(['data' => ['Web Development']]);
    }
}
