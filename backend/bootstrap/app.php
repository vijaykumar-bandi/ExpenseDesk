<?php

use App\Http\Middleware\EnsureActiveSession;
use App\Http\Middleware\RetryOnBusyDatabase;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // The API signs people in with Laravel's own session, so every API
        // request needs the session started and the CSRF token checked.
        $middleware->api(prepend: [
            \Illuminate\Cookie\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,
            \Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
            RetryOnBusyDatabase::class,
        ]);

        $middleware->api(append: [
            EnsureActiveSession::class,
        ]);

        $middleware->alias([
            'active.session' => EnsureActiveSession::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(function (Request $request) {
            return $request->is('api/*') || $request->expectsJson();
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            if ($e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException) {
                return response()->json(['message' => 'Not found'], 404);
            }

            if ($e instanceof \Symfony\Component\HttpKernel\Exception\NotFoundHttpException) {
                return response()->json(['message' => 'Not found'], 404);
            }

            if ($e instanceof \Illuminate\Auth\AuthenticationException) {
                return response()->json(['message' => 'Unauthenticated'], 401);
            }

            if ($e instanceof \Illuminate\Validation\ValidationException) {
                return response()->json([
                    'message' => $e->getMessage(),
                    'errors' => $e->errors(),
                ], 422);
            }

            if ($e instanceof \Illuminate\Http\Exceptions\ThrottleRequestsException) {
                return response()->json(
                    ['message' => 'Too many attempts. Try again in 15 minutes.'],
                    429,
                );
            }

            // The throttle middleware answers through a wrapped response.
            if ($e instanceof \Illuminate\Http\Exceptions\HttpResponseException) {
                $response = $e->getResponse();

                if ($response->getStatusCode() === 429) {
                    return response()->json(
                        ['message' => 'Too many attempts. Try again in 15 minutes.'],
                        429,
                    );
                }

                return $response;
            }

            if ($e instanceof \Illuminate\Auth\Access\AuthorizationException) {
                return response()->json(
                    ['message' => $e->getMessage() ?: \App\Policies\ReportPolicy::DENIED_MESSAGE],
                    403,
                );
            }

            if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                return response()->json(
                    ['message' => $e->getMessage() ?: 'Something went wrong. Try again.'],
                    $e->getStatusCode(),
                );
            }

            report($e);

            return response()->json(['message' => 'Something went wrong. Try again.'], 500);
        });
    })->create();
