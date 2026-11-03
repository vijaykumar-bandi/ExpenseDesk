<?php

namespace Tests;

use App\Models\Category;
use App\Models\Report;
use App\Models\ReportLine;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function makeUser(string $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $model = Role::firstOrCreate(['name' => $role]);
        $user->roles()->sync([$model->id]);

        return $user->refresh();
    }

    protected function makeCategory(string $name = 'Travel', bool $active = true): Category
    {
        return Category::firstOrCreate(['name' => $name], ['active' => $active]);
    }

    protected function makeReport(User $employee, array $attributes = []): Report
    {
        return Report::create(array_merge([
            'employee_id' => $employee->id,
            'title' => 'Test report',
            'business_purpose' => 'Testing',
            'status' => Report::STATUS_DRAFT,
            'total_paise' => 0,
        ], $attributes));
    }

    protected function makeLine(Report $report, int $paise = 10000, ?Category $category = null): ReportLine
    {
        $category ??= $this->makeCategory();

        return ReportLine::create([
            'report_id' => $report->id,
            'expense_date' => now()->subDay()->format('Y-m-d'),
            'category_id' => $category->id,
            'merchant' => 'Merchant',
            'amount_paise' => $paise,
        ]);
    }
}
