<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * Creates the live app's first Administrator from FIRST_ADMIN_EMAIL and
 * FIRST_ADMIN_PASSWORD when both are set and no account exists. Never seeds.
 */
class CreateFirstAdminCommand extends Command
{
    protected $signature = 'expensedesk:first-admin';

    protected $description = 'Create the first Administrator from FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD';

    public function handle(): int
    {
        $email = strtolower((string) config('expensedesk.first_admin_email'));
        $password = (string) config('expensedesk.first_admin_password');

        if ($email === '' || $password === '') {
            return self::SUCCESS;
        }

        if (User::query()->exists()) {
            return self::SUCCESS;
        }

        $user = User::create([
            'name' => 'Administrator',
            'email' => $email,
            'password' => $password,
            'active' => true,
        ]);

        $role = Role::firstOrCreate(['name' => User::ROLE_ADMINISTRATOR]);
        $user->roles()->sync([$role->id]);

        $this->info('First Administrator created: '.$email);

        return self::SUCCESS;
    }
}
