<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Report;
use App\Models\ReportLine;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds the four test logins of design.md, a second Manager, a second Employee
 * with a Draft, a Submitted and a Paid report, and the five categories.
 *
 * Idempotent: an already-seeded database is left as it is. Never runs in production.
 */
class DevelopmentSeeder extends Seeder
{
    public const LOGINS = [
        ['Administrator', 'admin@expensedesk.test', 'AdminPassw0rd!2026'],
        ['Finance', 'finance@expensedesk.test', 'FinancePassw0rd!2026'],
        ['Manager', 'manager@expensedesk.test', 'ManagerPassw0rd!2026'],
        ['Employee', 'employee@expensedesk.test', 'EmployeePassw0rd!2026'],
    ];

    public const CATEGORIES = ['Travel', 'Meals', 'Accommodation', 'Office Supplies', 'Other'];

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('DevelopmentSeeder never runs when APP_ENV=production.');

            return;
        }

        $roles = [];
        foreach (User::ROLES as $name) {
            $roles[$name] = Role::firstOrCreate(['name' => $name]);
        }

        $categories = [];
        foreach (self::CATEGORIES as $name) {
            $categories[$name] = Category::firstOrCreate(['name' => $name], ['active' => true]);
        }

        $manager = $this->ensureUser('Priya Sharma', 'manager@expensedesk.test', 'ManagerPassw0rd!2026', [$roles['Manager']]);
        $secondManager = $this->ensureUser('Rahul Verma', 'manager2@expensedesk.test', 'ManagerPassw0rd!2026', [$roles['Manager']]);

        $this->ensureUser('Anita Desai', 'admin@expensedesk.test', 'AdminPassw0rd!2026', [$roles['Administrator']]);
        $this->ensureUser('Vikram Rao', 'finance@expensedesk.test', 'FinancePassw0rd!2026', [$roles['Finance']]);

        $employee = $this->ensureUser('Arjun Mehta', 'employee@expensedesk.test', 'EmployeePassw0rd!2026', [$roles['Employee']], $manager->id);
        $secondEmployee = $this->ensureUser('Neha Kapoor', 'employee2@expensedesk.test', 'EmployeePassw0rd!2026', [$roles['Employee']], $secondManager->id);

        $this->seedSampleReports($employee, $manager, $categories);
        $this->seedSampleReports($secondEmployee, $secondManager, $categories);
    }

    private function ensureUser(string $name, string $email, string $password, array $roles, ?int $managerId = null): User
    {
        $user = User::firstOrCreate(
            ['email' => strtolower($email)],
            [
                'name' => $name,
                'password' => Hash::make($password),
                'manager_id' => $managerId,
                'active' => true,
            ],
        );

        if ($user->roles()->count() === 0) {
            $user->roles()->sync(collect($roles)->pluck('id')->all());
        }

        return $user;
    }

    private function seedSampleReports(User $employee, User $manager, array $categories): void
    {
        if ($employee->reports()->exists()) {
            return;
        }

        $draft = Report::create([
            'employee_id' => $employee->id,
            'title' => 'Client visit - Mumbai',
            'business_purpose' => 'Meet the client about the new contract.',
            'status' => Report::STATUS_DRAFT,
            'total_paise' => 0,
        ]);
        $this->addLine($draft, $categories['Travel'], '2026-10-02', 'IndiGo', 75050);

        $submitted = Report::create([
            'employee_id' => $employee->id,
            'manager_id' => $manager->id,
            'title' => 'Team offsite',
            'business_purpose' => 'Quarterly planning with the team.',
            'status' => Report::STATUS_SUBMITTED,
            'submitted_at' => now()->subDays(4),
        ]);
        $this->addLine($submitted, $categories['Accommodation'], '2026-10-05', 'Taj Hotel', 125025);
        $this->addLine($submitted, $categories['Meals'], '2026-10-05', 'Cafe Coffee Day', 45000);
        $submitted->forceFill(['total_paise' => 170025])->save();

        $paid = Report::create([
            'employee_id' => $employee->id,
            'manager_id' => $manager->id,
            'title' => 'Office supplies',
            'business_purpose' => 'Stationery for the new joiners.',
            'status' => Report::STATUS_PAID,
            'submitted_at' => now()->subDays(20),
            'decided_at' => now()->subDays(18),
            'paid_at' => now()->subDays(10),
        ]);
        $this->addLine($paid, $categories['Office Supplies'], '2026-09-20', 'Staples', 32000);
        $paid->forceFill(['total_paise' => 32000])->save();
    }

    private function addLine(Report $report, Category $category, string $date, string $merchant, int $paise): void
    {
        ReportLine::create([
            'report_id' => $report->id,
            'expense_date' => $date,
            'category_id' => $category->id,
            'merchant' => $merchant,
            'amount_paise' => $paise,
        ]);
    }
}
