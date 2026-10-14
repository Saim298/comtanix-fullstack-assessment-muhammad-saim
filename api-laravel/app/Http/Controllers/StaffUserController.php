<?php

namespace App\Http\Controllers;

use App\Http\Resources\StaffUserResource;
use App\Models\User;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class StaffUserController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', User::class);

        return StaffUserResource::collection(
            User::query()
                ->where('role', 'staff')
                ->orderBy('name')
                ->orderBy('id')
                ->get(['id', 'name', 'email'])
        );
    }
}
