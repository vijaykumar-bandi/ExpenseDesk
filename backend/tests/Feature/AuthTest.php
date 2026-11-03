<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_csrf_cookie_answers_204(): void
    {
        $this->getJson('/api/csrf-cookie')->assertNoContent();
    }

    public function test_login_with_valid_credentials_returns_the_user(): void
    {
        $user = $this->makeUser('Employee', [
            'email' => 'employee@expensedesk.test',
            'password' => Hash::make('EmployeePassw0rd!2026'),
        ]);

        $this->postJson('/api/login', [
            'email' => 'employee@expensedesk.test',
            'password' => 'EmployeePassw0rd!2026',
        ])->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.roles.0', 'Employee');

        $this->assertAuthenticatedAs($user);
    }

    public function test_login_with_wrong_password_answers_422(): void
    {
        $this->makeUser('Employee', [
            'email' => 'employee@expensedesk.test',
            'password' => Hash::make('EmployeePassw0rd!2026'),
        ]);

        $this->postJson('/api/login', [
            'email' => 'employee@expensedesk.test',
            'password' => 'wrong-password',
        ])->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Email or password is incorrect');
    }

    public function test_deactivated_account_cannot_sign_in(): void
    {
        $this->makeUser('Employee', [
            'email' => 'gone@expensedesk.test',
            'password' => Hash::make('EmployeePassw0rd!2026'),
            'active' => false,
        ]);

        $this->postJson('/api/login', [
            'email' => 'gone@expensedesk.test',
            'password' => 'EmployeePassw0rd!2026',
        ])->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Email or password is incorrect');

        $this->assertGuest();
    }

    public function test_five_failed_attempts_rate_limit_the_email(): void
    {
        $this->makeUser('Employee', [
            'email' => 'employee@expensedesk.test',
            'password' => Hash::make('EmployeePassw0rd!2026'),
        ]);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', [
                'email' => 'employee@expensedesk.test',
                'password' => 'wrong-password',
            ])->assertStatus(422);
        }

        $this->postJson('/api/login', [
            'email' => 'employee@expensedesk.test',
            'password' => 'EmployeePassw0rd!2026',
        ])->assertStatus(429)
            ->assertJsonPath('message', 'Too many attempts. Try again in 15 minutes.');
    }

    public function test_me_requires_a_session(): void
    {
        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_me_returns_the_signed_in_person(): void
    {
        $user = $this->makeUser('Manager');

        $this->actingAs($user)->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.roles.0', 'Manager');
    }

    public function test_logout_ends_the_session(): void
    {
        $user = $this->makeUser('Employee');

        $this->actingAs($user)->postJson('/api/logout')->assertNoContent();
        $this->assertGuest();
    }

    public function test_forgot_password_answers_the_same_message_for_unknown_email(): void
    {
        $this->postJson('/api/forgot-password', ['email' => 'nobody@expensedesk.test'])
            ->assertOk()
            ->assertJsonPath('message', 'If that email has an account, a reset link has been sent');
    }

    public function test_reset_password_with_an_invalid_token_answers_422(): void
    {
        $this->postJson('/api/reset-password', [
            'token' => 'not-a-real-token',
            'password' => 'NewPassword123456',
            'password_confirmation' => 'NewPassword123456',
        ])->assertStatus(422)
            ->assertJsonPath('errors.token.0', 'This reset link is no longer valid');
    }

    public function test_reset_password_rejects_a_short_password(): void
    {
        $this->postJson('/api/reset-password', [
            'token' => 'token',
            'password' => 'short',
            'password_confirmation' => 'short',
        ])->assertStatus(422);
    }

    public function test_deactivated_user_session_answers_401(): void
    {
        $user = $this->makeUser('Employee');
        $user->forceFill(['active' => false])->save();

        $this->actingAs($user->refresh())->getJson('/api/me')->assertStatus(401);
    }
}
