<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function csrfCookie(): JsonResponse
    {
        return response()->json(null, 204);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $email = strtolower($credentials['email']);
        $throttleKey = 'login:'.$email.'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, (int) config('expensedesk.login_max_attempts', 5))) {
            return response()->json(
                ['message' => 'Too many attempts. Try again in 15 minutes.'],
                429,
            );
        }

        $user = User::where('email', $email)->first();

        if (! $user || ! $user->active || ! Hash::check($credentials['password'], $user->password)) {
            RateLimiter::hit($throttleKey, (int) config('expensedesk.login_decay_minutes', 15) * 60);

            throw ValidationException::withMessages([
                'email' => ['Email or password is incorrect'],
            ])->status(422);
        }

        RateLimiter::clear($throttleKey);

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return response()->json(['user' => $user->load('roles')->toApiArray()]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(null, 204);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()->load('roles')->toApiArray()]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        $email = strtolower((string) $request->input('email'));
        $user = User::where('email', $email)->first();

        if ($user) {
            $token = Str::random(64);

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $email],
                ['token' => Hash::make($token), 'created_at' => now()],
            );

            // The mailer is the log driver in development; the token never leaves the server.
            logger()->info('Password reset link issued', ['email' => $email]);
        }

        return response()->json([
            'message' => 'If that email has an account, a reset link has been sent',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:12', 'confirmed'],
        ]);

        $invalid = ValidationException::withMessages([
            'token' => ['This reset link is no longer valid'],
        ])->status(422);

        $rows = DB::table('password_reset_tokens')->get();

        $match = null;
        foreach ($rows as $row) {
            if (Hash::check($data['token'], $row->token)) {
                $match = $row;
                break;
            }
        }

        if (! $match) {
            throw $invalid;
        }

        $minutes = (int) config('expensedesk.reset_token_minutes', 60);
        $createdAt = $match->created_at ? \Illuminate\Support\Carbon::parse($match->created_at) : null;

        if (! $createdAt || $createdAt->copy()->addMinutes($minutes)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $match->email)->delete();

            throw $invalid;
        }

        $user = User::where('email', $match->email)->first();
        if (! $user) {
            DB::table('password_reset_tokens')->where('email', $match->email)->delete();

            throw $invalid;
        }

        $user->forceFill(['password' => Hash::make($data['password'])])->save();
        DB::table('password_reset_tokens')->where('email', $match->email)->delete();

        return response()->json(['message' => 'Your password has been reset']);
    }
}
