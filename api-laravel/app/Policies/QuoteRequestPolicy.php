<?php

namespace App\Policies;

use App\Models\QuoteRequest;
use App\Models\User;

class QuoteRequestPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return in_array($user->role, ['admin', 'staff'], true);
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, QuoteRequest $quoteRequest): bool
    {
        return in_array($user->role, ['admin', 'staff'], true);
    }

     public function updateStatus(User $user, QuoteRequest $quoteRequest): bool
    {
        return $user->role === 'admin'
            || (
                $user->role === 'staff'
                && $quoteRequest->assigned_user_id === $user->id
            );
    }

    public function assign(User $user, QuoteRequest $quoteRequest): bool
    {
        return $user->role === 'admin';
    }

    public function delete(User $user, QuoteRequest $quoteRequest): bool
    {
        return $user->role === 'admin';
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return false;
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, QuoteRequest $quoteRequest): bool
    {
        return false;
    }

   

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, QuoteRequest $quoteRequest): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, QuoteRequest $quoteRequest): bool
    {
        return false;
    }
}
