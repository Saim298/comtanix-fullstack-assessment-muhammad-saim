<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\QuoteRequestController;

Route::post('/public/quote-requests', [QuoteRequestController::class, 'store'])
    ->middleware('throttle:5,1');

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});