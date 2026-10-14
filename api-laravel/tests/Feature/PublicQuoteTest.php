<?php

namespace Tests\Feature;

use App\Jobs\SendAuditEventJob;
use App\Services\AuditEventPublisher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class PublicQuoteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake([SendAuditEventJob::class]);
        Http::preventStrayRequests();
    }

    private function payload(): array
    {
        return [
            'client_name' => 'Public Client',
            'email' => 'public@example.test',
            'company' => '',
            'service_type' => 'Custom API integration',
            'budget_range' => '1000_5000',
            'message' => 'We need an API integration for our website.',
            'website' => '',
        ];
    }

    public function test_guest_submission_creates_one_quote_and_one_audit_job(): void
    {
        $response = $this->postJson('/api/public/quote-requests', $this->payload())
            ->assertCreated()->assertJsonPath('data.status', 'new')->assertJsonPath('data.assigned_user_id', null);

        $id = $response->json('data.id');
        $this->assertIsInt($id);
        $this->assertDatabaseCount('quote_requests', 1);
        $this->assertDatabaseHas('quote_requests', ['id' => $id, 'email' => 'public@example.test', 'company' => null]);
        Queue::assertPushed(SendAuditEventJob::class, 1);
        Queue::assertPushed(SendAuditEventJob::class, fn ($job) => $job->event['quoteRequestId'] === $id
            && $job->event['type'] === 'quote.created' && $job->event['actorId'] === null && $job->afterCommit === true);
        Http::assertNothingSent();
    }

    public function test_public_submission_does_not_require_a_valid_staff_token(): void
    {
        $this->withToken('expired-token')->postJson('/api/public/quote-requests', $this->payload())->assertCreated();
    }

    public function test_missing_required_fields_are_rejected(): void
    {
        $this->postJson('/api/public/quote-requests', [])->assertUnprocessable()
            ->assertJsonValidationErrors(['client_name', 'email', 'service_type', 'budget_range', 'message']);
        $this->assertDatabaseCount('quote_requests', 0);
        Queue::assertNothingPushed();
    }

    public function test_invalid_email_budget_and_whitespace_message_are_rejected(): void
    {
        $this->postJson('/api/public/quote-requests', [...$this->payload(),
            'email' => 'invalid', 'budget_range' => 'free', 'message' => '            ',
        ])->assertUnprocessable()->assertJsonValidationErrors(['email', 'budget_range', 'message']);
        $this->assertDatabaseCount('quote_requests', 0);
        Queue::assertNothingPushed();
    }

    public function test_public_input_length_limits_are_enforced(): void
    {
        $this->postJson('/api/public/quote-requests', [...$this->payload(),
            'client_name' => str_repeat('n', 151), 'email' => str_repeat('e', 256),
            'company' => str_repeat('c', 151), 'service_type' => str_repeat('s', 101),
            'message' => str_repeat('m', 5001),
        ])->assertUnprocessable()->assertJsonValidationErrors(['client_name', 'email', 'company', 'service_type', 'message']);
        $this->postJson('/api/public/quote-requests', [...$this->payload(), 'message' => 'short'])
            ->assertUnprocessable()->assertJsonValidationErrors(['message']);
        $this->assertDatabaseCount('quote_requests', 0);
    }

    public function test_honeypot_and_server_controlled_fields_are_rejected(): void
    {
        $this->postJson('/api/public/quote-requests', [...$this->payload(),
            'website' => 'https://spam.example', 'status' => 'closed', 'assigned_user_id' => 1,
            'id' => 999, 'created_at' => '2020-01-01', 'updated_at' => '2020-01-01',
        ])->assertUnprocessable()->assertJsonValidationErrors(['website', 'status', 'assigned_user_id', 'id', 'created_at', 'updated_at']);
        $this->assertDatabaseCount('quote_requests', 0);
        Queue::assertNothingPushed();
    }

    public function test_sixth_public_submission_is_rate_limited(): void
    {
        config()->set('app.debug', true);
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/public/quote-requests', $this->payload())->assertCreated();
        }
        $this->postJson('/api/public/quote-requests', $this->payload())->assertStatus(429)->assertHeader('Retry-After')
            ->assertExactJson(['message' => 'Too many requests. Please try again later.']);
        $this->assertDatabaseCount('quote_requests', 5);
        Queue::assertPushed(SendAuditEventJob::class, 5);
    }

    public function test_public_server_errors_do_not_expose_exception_details(): void
    {
        config()->set('app.debug', true);
        $this->mock(AuditEventPublisher::class)->shouldReceive('publish')
            ->once()->andThrow(new \RuntimeException('Private connection password and stack trace'));

        $this->postJson('/api/public/quote-requests', $this->payload())->assertStatus(500)
            ->assertExactJson(['message' => 'Unable to process your request at this time.']);
        $this->assertDatabaseCount('quote_requests', 0);
        Queue::assertNothingPushed();
    }

    public function test_public_service_unavailable_errors_preserve_status_without_details(): void
    {
        config()->set('app.debug', true);
        $this->mock(AuditEventPublisher::class)->shouldReceive('publish')
            ->once()->andThrow(new \Symfony\Component\HttpKernel\Exception\HttpException(503, 'Private infrastructure details'));

        $this->postJson('/api/public/quote-requests', $this->payload())->assertStatus(503)
            ->assertExactJson(['message' => 'Unable to process your request at this time.']);
        $this->assertDatabaseCount('quote_requests', 0);
    }
}
