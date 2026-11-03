<?php

namespace Tests\Feature;

use App\Models\Report;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DecisionTest extends TestCase
{
    use RefreshDatabase;

    private function submittedReport(): array
    {
        $manager = $this->makeUser('Manager');
        $employee = $this->makeUser('Employee', ['manager_id' => $manager->id]);
        $report = $this->makeReport($employee, [
            'manager_id' => $manager->id,
            'status' => Report::STATUS_SUBMITTED,
            'submitted_at' => now(),
        ]);

        return [$manager, $employee, $report];
    }

    public function test_manager_approves_a_submitted_report(): void
    {
        [$manager, , $report] = $this->submittedReport();

        $this->actingAs($manager)->postJson('/api/reports/'.$report->id.'/decision', [
            'decision' => 'approve',
        ])->assertOk()->assertJsonPath('data.status', 'approved');

        $this->assertDatabaseHas('audit_events', [
            'report_id' => $report->id,
            'action' => 'approved',
        ]);
    }

    public function test_request_changes_needs_a_reason_of_ten_characters(): void
    {
        [$manager, , $report] = $this->submittedReport();

        $this->actingAs($manager)->postJson('/api/reports/'.$report->id.'/decision', [
            'decision' => 'request_changes',
            'reason' => 'short',
        ])->assertStatus(422)
            ->assertJsonPath('errors.reason.0', 'Reason must be at least 10 characters');
    }

    public function test_employee_cannot_decide_on_own_report(): void
    {
        [, $employee, $report] = $this->submittedReport();

        $this->actingAs($employee)->postJson('/api/reports/'.$report->id.'/decision', [
            'decision' => 'approve',
        ])->assertStatus(403)
            ->assertJsonPath('message', 'You cannot decide on your own report');
    }

    public function test_a_second_decision_answers_409(): void
    {
        [$manager, , $report] = $this->submittedReport();

        $this->actingAs($manager)->postJson('/api/reports/'.$report->id.'/decision', [
            'decision' => 'approve',
        ])->assertOk();

        $this->actingAs($manager)->postJson('/api/reports/'.$report->id.'/decision', [
            'decision' => 'reject',
            'reason' => 'This is a long enough reason',
        ])->assertStatus(409)
            ->assertJsonPath('data.status', 'approved');
    }

    public function test_an_unassigned_manager_cannot_decide(): void
    {
        [, , $report] = $this->submittedReport();
        $otherManager = $this->makeUser('Manager');

        $this->actingAs($otherManager)->postJson('/api/reports/'.$report->id.'/decision', [
            'decision' => 'approve',
        ])->assertStatus(403);
    }
}
