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

            $allowed = self::TRANSITIONS[$quote->status] ?? [];

            if (!in_array($newStatus, $allowed, true)) {
                throw ValidationException::withMessages([
                    'status' => [
                        "Cannot transition from {$quote->status} to {$newStatus}.",
                    ],
                ]);
            }

            $quote->status = $newStatus;
            $quote->save();

            return $quote->load('assignedUser:id,name,email');
        });
    }
}
