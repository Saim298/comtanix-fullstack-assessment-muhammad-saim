<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreQuoteRequestRequest;
use App\Http\Resources\QuoteRequestResource;
use App\Models\QuoteRequest;
use Illuminate\Http\JsonResponse;
use App\Http\Requests\ListQuoteRequestsRequest;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use App\Http\Requests\AssignQuoteRequestRequest;
use App\Http\Requests\UpdateQuoteStatusRequest;
use App\Services\QuoteAssignmentService;
use App\Services\QuoteStatusService;

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

    public function index(ListQuoteRequestsRequest $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', QuoteRequest::class);

        $filters = $request->validated();

        $query = QuoteRequest::query()
            ->with('assignedUser:id,name,email');

        if (!empty($filters['search'])) {
            $search = trim($filters['search']);

            $query->where(function ($query) use ($search) {
                $query->where('client_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('company', 'like', "%{$search}%");
            });
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['assigned_user_id'])) {
            $query->where('assigned_user_id', $filters['assigned_user_id']);
        }

        if (!empty($filters['service_type'])) {
            $query->where('service_type', $filters['service_type']);
        }

        $sortBy = $filters['sort_by'] ?? 'created_at';
        $direction = $filters['sort_direction'] ?? 'desc';

        $query->orderBy($sortBy, $direction);

        if ($sortBy !== 'id') {
            $query->orderBy('id', 'desc');
        }

        return QuoteRequestResource::collection(
            $query->paginate($filters['per_page'] ?? 20)->withQueryString()
        );
    }

    public function show(QuoteRequest $quoteRequest): QuoteRequestResource
    {
        Gate::authorize('view', $quoteRequest);

        return new QuoteRequestResource(
            $quoteRequest->load('assignedUser:id,name,email')
        );
    }


    public function assign(
        AssignQuoteRequestRequest $request,
        QuoteRequest $quoteRequest,
        QuoteAssignmentService $service
    ): QuoteRequestResource {
        $quote = $service->assign(
            $quoteRequest,
            $request->user(),
            (int) $request->validated('assigned_user_id')
        );

        return new QuoteRequestResource($quote);
    }

    public function updateStatus(
        UpdateQuoteStatusRequest $request,
        QuoteRequest $quoteRequest,
        QuoteStatusService $service
    ): QuoteRequestResource {
        $quote = $service->transition(
            $quoteRequest,
            $request->user(),
            $request->validated('status')
        );

        return new QuoteRequestResource($quote);
    }


    public function destroy(QuoteRequest $quoteRequest): \Illuminate\Http\Response
    {
        Gate::authorize('delete', $quoteRequest);

        $quoteRequest->delete();

        return response()->noContent();
    }


}
