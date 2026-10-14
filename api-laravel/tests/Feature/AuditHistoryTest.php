<?php

namespace Tests\Feature;

use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuditHistoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('services.audit.url', 'http://audit.test');
        config()->set('services.audit.read_token', 'test-read-token');
        Http::preventStrayRequests();
    }

    public function test_staff_can_read_paginated_audit_history_through_laravel(): void
    {
        $quote = QuoteRequest::factory()->create();
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        $payload = [
            'data' => [[
                'eventId' => '6b1bf44b-29a7-4a28-b761-5eebafed625e',
                'type' => 'quote.status_changed',
                'quoteRequestId' => $quote->id,
                'actorId' => 1,
                'data' => ['oldStatus' => 'new', 'newStatus' => 'in_review'],
                'occurredAt' => '2026-10-14T10:00:00Z',
            ]],
            'meta' => ['current_page' => 2, 'per_page' => 10, 'total' => 11, 'last_page' => 2],
        ];
        Http::fake(['http://audit.test/events*' => Http::response($payload)]);

        $this->getJson("/api/quote-requests/{$quote->id}/events?page=2&per_page=10")
            ->assertOk()->assertExactJson($payload);

        Http::assertSent(fn (Request $request) => $request['quoteRequestId'] === $quote->id
            && (int) $request['page'] === 2
            && (int) $request['per_page'] === 10
            && $request->hasHeader('X-Audit-Read-Token', 'test-read-token'));
    }

    public function test_audit_outage_does_not_break_quote_details(): void
    {
        $quote = QuoteRequest::factory()->create();
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        Http::fake(fn () => throw new ConnectionException('Audit service offline'));

        $this->getJson("/api/quote-requests/{$quote->id}/events")
            ->assertStatus(503)->assertJsonPath('message', 'Audit service is temporarily unavailable.');
        $this->getJson("/api/quote-requests/{$quote->id}")->assertOk()->assertJsonPath('data.id', $quote->id);
    }

    public function test_invalid_audit_page_is_rejected_before_calling_node(): void
    {
        $quote = QuoteRequest::factory()->create();
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']));
        Http::fake();

        $this->getJson("/api/quote-requests/{$quote->id}/events?page=0&per_page=101")->assertUnprocessable();
        Http::assertNothingSent();
    }

    public function test_upstream_failure_is_reported_without_leaking_its_body(): void
    {
        $quote = QuoteRequest::factory()->create();
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        Http::fake(['http://audit.test/events*' => Http::response(['internal' => 'private diagnostic'], 500)]);

        $this->getJson("/api/quote-requests/{$quote->id}/events")
            ->assertStatus(502)->assertExactJson(['message' => 'Audit history is temporarily unavailable.']);
    }
}
