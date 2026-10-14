<?php

namespace App\Http\Controllers;

use App\Models\QuoteRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;

class AuditTrailController extends Controller
{
    public function index(Request $request, QuoteRequest $quoteRequest): JsonResponse
    {
        Gate::authorize('view', $quoteRequest);

        $filters = $request->validate([
            'type' => [
                'sometimes',
                Rule::in([
                    'quote.created',
                    'quote.assigned',
                    'quote.status_changed'
                ])
            ],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'between:1,100']
        ]);

        $url = config('services.audit.url');
        $token = config('services.audit.read_token');

        if (!is_string($url) || !$url || !is_string($token) || !$token) {
            return response()->json([
                'message' => 'Audit service is not configured.'
            ], 503);
        }

        try {
            $response = Http::acceptJson()
                ->withHeaders([
                    'X-Audit-Read-Token' => $token
                ])
                ->connectTimeout(2)
                ->timeout(5)
                ->get(rtrim($url, '/') . '/events', [
                    ...$filters,
                    'quoteRequestId' => $quoteRequest->id
                ]);

            if (!$response->successful()) {
                return response()->json([
                    'message' => 'Audit history is temporarily unavailable.'
                ], 502);
            }

            return response()->json($response->json());
        } catch (ConnectionException $exception) {
            return response()->json([
                'message' => 'Audit service is temporarily unavailable.'
            ], 503);
        }
    }
}
