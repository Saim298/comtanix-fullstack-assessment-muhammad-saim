<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\QuoteRequestController;
use App\Http\Controllers\AuthController;

Route::post('/public/quote-requests', [QuoteRequestController::class, 'store'])
    ->middleware('throttle:5,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/quote-requests', [QuoteRequestController::class, 'index']);
    Route::get('/quote-requests/{quoteRequest}', [QuoteRequestController::class, 'show']);
    Route::patch('/quote-requests/{quoteRequest}/assign', [QuoteRequestController::class, 'assign']);

    Route::patch('/quote-requests/{quoteRequest}/status', [QuoteRequestController::class, 'updateStatus']);
    Route::delete('/quote-requests/{quoteRequest}', [QuoteRequestController::class, 'destroy']);
});


Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:5,1');
