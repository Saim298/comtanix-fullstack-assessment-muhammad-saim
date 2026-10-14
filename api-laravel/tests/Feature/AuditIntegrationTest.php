<?php

namespace Tests\Feature;

use App\Jobs\SendAuditEventJob;
use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuditIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_quote_dispatches_audit_event(): void
    {
        Queue::fake();

        $response = $this->postJson('/api/public/quote-requests', [
            'client_name' => 'Test Client',
            'email' => 'client@example.com',
            'company' => 'Test Company',
            'service_type' => 'Web Development',
            'budget_range' => '1000_5000',
            'message' => 'I need a business website with custom features.',
        ]);

        $response->assertCreated();
        $this->assertDatabaseCount('quote_requests', 1);

        Queue::assertPushed(SendAuditEventJob::class, 1);
        
        $quoteId = $response->json('data.id');

        Queue::assertPushed(
            SendAuditEventJob::class,
            function (SendAuditEventJob $job) use ($quoteId) {
                return $job->event['type'] === 'quote.created'
                    && $job->event['quoteRequestId'] === $quoteId
                    && $job->event['actorId'] === null
                    && $job->afterCommit === true;
            }
        );
    }

    public function test_assigning_quote_dispatches_audit_event(): void
    {
        Queue::fake();

        $admin = User::factory()->create(['role' => 'admin']);
        $staff = User::factory()->create(['role' => 'staff']);
        $quote = QuoteRequest::factory()->create();

        Sanctum::actingAs($admin);

        $this->patchJson("/api/quote-requests/{$quote->id}/assign", [
            'assigned_user_id' => $staff->id,
        ])->assertOk();

        Queue::assertPushed(
            SendAuditEventJob::class,
            function (SendAuditEventJob $job) use ($quote, $admin, $staff) {
                return $job->event['type'] === 'quote.assigned'
                    && $job->event['quoteRequestId'] === $quote->id
                    && $job->event['actorId'] === $admin->id
                    && $job->event['data']['oldAssignedUserId'] === null
                    && $job->event['data']['newAssignedUserId'] === $staff->id;
            }
        );
    }

    public function test_changing_status_dispatches_audit_event(): void
    {
        Queue::fake();

        $staff = User::factory()->create(['role' => 'staff']);

        $quote = QuoteRequest::factory()->create([
            'assigned_user_id' => $staff->id,
            'status' => 'new',
        ]);

        Sanctum::actingAs($staff);

        $this->patchJson("/api/quote-requests/{$quote->id}/status", [
            'status' => 'in_review',
        ])->assertOk();

        Queue::assertPushed(
            SendAuditEventJob::class,
            function (SendAuditEventJob $job) use ($quote, $staff) {
                return $job->event['type'] === 'quote.status_changed'
                    && $job->event['quoteRequestId'] === $quote->id
                    && $job->event['actorId'] === $staff->id
                    && $job->event['data']['oldStatus'] === 'new'
                    && $job->event['data']['newStatus'] === 'in_review';
            }
        );
    }

    public function test_invalid_transition_does_not_publish_event(): void
    {
        Queue::fake();

        $admin = User::factory()->create(['role' => 'admin']);

        $quote = QuoteRequest::factory()->create([
            'status' => 'new',
        ]);

        Sanctum::actingAs($admin);

        $this->patchJson("/api/quote-requests/{$quote->id}/status", [
            'status' => 'closed',
        ])->assertUnprocessable();

        Queue::assertNotPushed(SendAuditEventJob::class);
    }

    public function test_audit_history_requires_authentication(): void
    {
        $quote = QuoteRequest::factory()->create();

        $this->getJson("/api/quote-requests/{$quote->id}/events")
            ->assertUnauthorized();
    }

    public function test_audit_history_is_retrieved_through_laravel(): void
    {
        config()->set('services.audit.url', 'http://audit.test');
        config()->set('services.audit.read_token', 'test-read-token');

        Http::fake([
            'http://audit.test/events*' => Http::response([
                'data' => [],
                'meta' => [
                    'current_page' => 1,
                    'per_page' => 20,
                    'total' => 0,
                    'last_page' => 1,
                ],
            ], 200),
        ]);

        $admin = User::factory()->create(['role' => 'admin']);
        $quote = QuoteRequest::factory()->create();

        Sanctum::actingAs($admin);

        $this->getJson("/api/quote-requests/{$quote->id}/events")
            ->assertOk()
            ->assertJsonPath('meta.total', 0);

        Http::assertSent(function (HttpRequest $request) use ($quote) {
            return str_contains(
                $request->url(),
                'quoteRequestId=' . $quote->id
            ) && $request->hasHeader(
                        'X-Audit-Read-Token',
                        'test-read-token'
                    );
        });
    }

    public function test_audit_job_signs_exact_request_body(): void
    {
        config()->set('services.audit.url', 'http://audit.test');
        config()->set('services.audit.shared_secret', 'test-signing-secret');

        Http::fake([
            'http://audit.test/events' => Http::response([
                'message' => 'Audit event stored.',
            ], 201),
        ]);

        $job = new SendAuditEventJob([
            'eventId' => 'e550e840-e29b-41d4-a716-446655440000',
            'type' => 'quote.created',
            'quoteRequestId' => 123,
            'actorId' => null,
            'data' => ['serviceType' => 'Web Development'],
            'occurredAt' => '2026-10-14T10:00:00Z',
        ]);

        $job->handle();

        Http::assertSent(function (HttpRequest $request) {
            $signature = hash_hmac(
                'sha256',
                $request->body(),
                'test-signing-secret'
            );

            return $request->hasHeader('X-Signature', $signature);
        });
    }
}
