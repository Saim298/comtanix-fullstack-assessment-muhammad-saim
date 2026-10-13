<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreQuoteRequestRequest;
use App\Http\Resources\QuoteRequestResource;
use App\Models\QuoteRequest;
use Illuminate\Http\JsonResponse;

class QuoteRequestController extends Controller
{
    public function store(StoreQuoteRequestRequest $request): JsonResponse
    {
        $quoteRequest = QuoteRequest::create(
            $request->safe()->only([
                'client_name',
                'email',
                'company',
                'service_type',
                'budget_range',
                'message'
            ])
        );

        return (new QuoteRequestResource($quoteRequest))
            ->response()
            ->setStatusCode(201);
    }
}
