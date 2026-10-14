<?php

namespace App\Jobs;


use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class SendAuditEventJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 9;

    public int $timeout = 15;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public array $event
    ) {
    }

    public function backoff(): array
    {
        return [10, 30, 60, 120, 240, 360, 600, 900];
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $url = config('services.audit.url');
        $secret = config('services.audit.shared_secret');

        if (!is_string($secret) || $secret === '') {
            throw new RuntimeException('Audit shared secret is not configured.');
        }

        if (!is_string($url) || $url === '') {
            throw new RuntimeException('Audit service URL is not configured.');
        }

        $body = json_encode(
            $this->event,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES
        );

        $signature = hash_hmac('sha256', $body, $secret);

        Http::withHeaders([
            'X-Signature' => $signature
        ])
            ->withBody($body, 'application/json')
            ->connectTimeout(3)
            ->timeout(8)
            ->post(rtrim($url, '/') . '/events')
            ->throw();
    }
}
