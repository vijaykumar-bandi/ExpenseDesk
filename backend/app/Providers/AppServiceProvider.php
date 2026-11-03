<?php

namespace App\Providers;

use App\Models\Report;
use App\Models\User;
use App\Policies\ReportPolicy;
use App\Policies\UserPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::policy(Report::class, ReportPolicy::class);
        Gate::policy(User::class, UserPolicy::class);

        // 5 failed sign-in attempts per email per 15 minutes.
        RateLimiter::for('login', function (Request $request) {
            $email = strtolower((string) $request->input('email'));

            return Limit::perMinutes(
                (int) config('expensedesk.login_decay_minutes', 15),
                (int) config('expensedesk.login_max_attempts', 5),
            )->by($email.'|'.$request->ip())->response(function () {
                return response()->json(
                    ['message' => 'Too many attempts. Try again in 15 minutes.'],
                    429,
                );
            });
        });
    }
}
