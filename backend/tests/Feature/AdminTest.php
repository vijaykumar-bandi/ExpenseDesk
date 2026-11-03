<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_cannot_read_the_user_list(): void
    {
        $employee = $this->makeUser('Employee');

        $this->actingAs($employee)->getJson('/api/admin/users')
            ->assertStatus(403)
            ->assertJsonPath('message', 'You do not have access to this page');
    }

    public function test_administrator_creates_a_user_with_a_role(): void
    {
        $admin = $this->makeUser('Administrator');

        $this->actingAs($admin)->postJson('/api/admin/users', [
            'name' => 'New Person',
            'email' => 'New.Person@expensedesk.test',
            'roles' => ['Employee'],
            'password' => 'Password123456',
        ])->assertCreated()
            ->assertJsonPath('data.email', 'new.person@expensedesk.test')
            ->assertJsonPath('data.roles.0', 'Employee');
    }

    public function test_a_short_initial_password_answers_422(): void
    {
        $admin = $this->makeUser('Administrator');

        $this->actingAs($admin)->postJson('/api/admin/users', [
            'name' => 'New Person',
            'email' => 'new@expensedesk.test',
            'roles' => ['Employee'],
            'password' => 'short',
        ])->assertStatus(422)
            ->assertJsonPath('errors.password.0', 'Password must be at least 12 characters');
    }

    public function test_deactivating_a_user_ends_their_sessions(): void
    {
        $admin = $this->makeUser('Administrator');
        $target = $this->makeUser('Employee');

        DB::table('sessions')->insert([
            'id' => 'session-1',
            'user_id' => $target->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'test',
            'payload' => 'x',
            'last_activity' => time(),
        ]);

        $this->actingAs($admin)->patchJson('/api/admin/users/'.$target->id, ['active' => false])
            ->assertOk()
            ->assertJsonPath('data.active', false);

        $this->assertSame(0, DB::table('sessions')->where('user_id', $target->id)->count());
    }

    public function test_administrator_reassigns_a_submitted_report(): void
    {
        $admin = $this->makeUser('Administrator');
        $manager = $this->makeUser('Manager');
        $employee = $this->makeUser('Employee');
        $report = $this->makeReport($employee, [
            'status' => Report::STATUS_SUBMITTED,
            'submitted_at' => now(),
        ]);

        $this->actingAs($admin)->postJson('/api/admin/reports/'.$report->id.'/reassign', [
            'manager_id' => $manager->id,
            'reason' => 'Original manager is on leave',
        ])->assertOk()
            ->assertJsonPath('data.manager.id', $manager->id);

        $this->assertDatabaseHas('audit_events', [
            'report_id' => $report->id,
            'action' => 'reassigned',
        ]);
    }

    public function test_reassign_needs_a_reason_of_ten_characters(): void
    {
        $admin = $this->makeUser('Administrator');
        $manager = $this->makeUser('Manager');
        $employee = $this->makeUser('Employee');
        $report = $this->makeReport($employee, ['status' => Report::STATUS_SUBMITTED]);

        $this->actingAs($admin)->postJson('/api/admin/reports/'.$report->id.'/reassign', [
            'manager_id' => $manager->id,
            'reason' => 'short',
        ])->assertStatus(422)
            ->assertJsonPath('errors.reason.0', 'Reason must be at least 10 characters');
    }

    public function test_categories_list_only_active_ones_for_the_editor(): void
    {
        $employee = $this->makeUser('Employee');
        $this->makeCategory('Travel', true);
        $this->makeCategory('Old', false);

        $this->actingAs($employee)->getJson('/api/categories')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Travel');
    }

    public function test_administrator_creates_and_deactivates_a_category(): void
    {
        $admin = $this->makeUser('Administrator');

        $id = $this->actingAs($admin)->postJson('/api/admin/categories', ['name' => 'Training'])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($admin)->patchJson('/api/admin/categories/'.$id, ['active' => false])
            ->assertOk()
            ->assertJsonPath('data.active', false);

        $this->assertFalse(Category::find($id)->active);
    }

    public function test_audit_history_is_paged_and_admin_only(): void
    {
        $admin = $this->makeUser('Administrator');
        $employee = $this->makeUser('Employee');

        $this->actingAs($employee)->getJson('/api/admin/audit')->assertStatus(403);

        $this->actingAs($admin)->getJson('/api/admin/audit')
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'total']]);
    }

    public function test_administrator_can_view_any_report(): void
    {
        $admin = $this->makeUser('Administrator');
        $employee = $this->makeUser('Employee');
        $report = $this->makeReport($employee);

        $this->actingAs($admin)->getJson('/api/reports/'.$report->id)->assertOk();
    }
}
