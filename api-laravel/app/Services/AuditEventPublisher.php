<?php

namespace App\Services;

use App\Jobs\SendAuditEventJob;
use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Support\Str;

class AuditEventPublisher
{
    public function publish(
        string $type,
        QuoteRequest $quote,
        ?User $actor,
        array $data
    ): void {
        SendAuditEventJob::dispatch([
            'eventId' => (string) Str::uuid(),
            'type' => $type,
            'quoteRequestId' => (int) $quote->id,
            'actorId' => $actor?->id,
            'data' => $data,
            'occurredAt' => now()->toISOString()
        ])->afterCommit();
    }
}
