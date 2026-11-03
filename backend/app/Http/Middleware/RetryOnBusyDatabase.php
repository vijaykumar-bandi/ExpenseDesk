<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Retries a request for up to 5 seconds when SQLite answers SQLITE_BUSY,
 * then answers 503 "The system is busy. Try again.".
 */
class RetryOnBusyDatabase
{
    private const MAX_SECONDS = 5;

    public function handle(Request $request, Closure $next): Response
    {
        $deadline = microtime(true) + self::MAX_SECONDS;

        while (true) {
            try {
                return $next($request);
            } catch (Throwable $e) {
                if (! $this->isBusy($e) || microtime(true) >= $deadline) {
                    if ($this->isBusy($e)) {
                        return response()->json(['message' => 'The system is busy. Try again.'], 503);
                    }

                    throw $e;
                }

                usleep(100_000);
            }
        }
    }

    private function isBusy(Throwable $e): bool
    {
        $message = $e->getMessage();

        return str_contains($message, 'database is locked')
            || str_contains($message, 'SQLITE_BUSY')
            || str_contains($message, 'database table is locked');
    }
}
