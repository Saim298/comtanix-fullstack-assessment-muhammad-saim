<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        $exceptions->respond(function (Response $response) {
            if (request()->is('api/public/quote-requests') && $response->getStatusCode() === 429) {
                $headers = array_intersect_key($response->headers->all(), array_flip([
                    'retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset',
                ]));

                return response()->json(['message' => 'Too many requests. Please try again later.'], 429, $headers);
            }

            if (request()->is('api/public/quote-requests') && $response->getStatusCode() >= 500) {
                return response()->json(['message' => 'Unable to process your request at this time.'], $response->getStatusCode());
            }

            return $response;
        });
    })->create();
