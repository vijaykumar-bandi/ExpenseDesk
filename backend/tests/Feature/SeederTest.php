<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DevelopmentSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_seeder_creates_the_four_test_logins(): void
    {
        $this->seed(DevelopmentSeeder::class);

        foreach (DevelopmentSeeder::LOGINS as [$role, $email, $password]) {
            $user = User::where('email', $email)->first();

            $this->assertNotNull($user, "Missing login {$email}");
            $this->assertTrue($user->hasRole($role), "{$email} is not {$role}");
            $this->assertTrue(Hash::check($password, $user->password), "{$email} password does not match");
        }
    }

    public function test_the_seeder_is_idempotent(): void
    {
        $this->seed(DevelopmentSeeder::class);
        $count = User::count();

        $this->seed(DevelopmentSeeder::class);

        $this->assertSame($count, User::count());
    }
}
