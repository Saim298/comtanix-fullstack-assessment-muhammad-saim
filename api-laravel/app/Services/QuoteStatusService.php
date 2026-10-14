<?php

namespace App\Services;

use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class QuoteStatusService
{
    private const TRANSITIONS = [
        'new' => ['in_review'],
        'in_review' => ['quoted', 'closed'],
        'quoted' => ['closed'],
        'closed' => [],
    ];

    public function __construct(
        private readonly AuditEventPublisher $audit
    ) {
    }

    public function transition(
        QuoteRequest $quoteRequest,
        User $actor,
        string $newStatus
    ): QuoteRequest {
        return DB::transaction(function () use ($quoteRequest, $actor, $newStatus) {
            $quote = QuoteRequest::query()
                ->lockForUpdate()
                ->findOrFail($quoteRequest->getKey());

            Gate::forUser($actor)->authorize('updateStatus', $quote);

            $previousStatus = $quote->status;

            $allowed = self::TRANSITIONS[$previousStatus] ?? [];

            if (!in_array($newStatus, $allowed, true)) {
                throw ValidationException::withMessages([
                    'status' => [
                        "Cannot transition from {$previousStatus} to {$newStatus}."
                    ]
                ]);
            }

            $quote->status = $newStatus;
            $quote->save();

            $this->audit->publish(
                'quote.status_changed',
                $quote,
                $actor,
                [
                    'oldStatus' => $previousStatus,
                    'newStatus' => $newStatus
                ]
            );

            return $quote->load('assignedUser:id,name,email');
        });
    }
}
