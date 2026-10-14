<?php

namespace App\Services;

use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class QuoteAssignmentService
{
    public function assign(
        QuoteRequest $quoteRequest,
        User $actor,
        int $staffId
    ): QuoteRequest {
        return DB::transaction(function () use ($quoteRequest, $actor, $staffId) {
            $quote = QuoteRequest::query()
                ->lockForUpdate()
                ->findOrFail($quoteRequest->getKey());

            Gate::forUser($actor)->authorize('assign', $quote);

            $quote->assigned_user_id = $staffId;
            $quote->save();

            return $quote->load('assignedUser:id,name,email');
        });
    }
}
