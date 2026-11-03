<?php

namespace Tests\Feature;

use App\Models\Report;
use App\Models\Reimbursement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinanceTest extends TestCase
{
    use RefreshDatabase;

    private function approvedReport(int $paise = 200075): Report
    {
        $manager = $this->makeUser('Manager');
        $employee = $this->makeUser('Employee', ['manager_id' => $manager->id]);

        return $this->makeReport($employee, [
            'manager_id' => $manager->id,
            'status' => Report::STATUS_APPROVED,
            'total_paise' => $paise,
            'submitted_at' => now()->subDays(5),
            'decided_at' => now()->subDays(3),
        ]);
    }

    public function test_employee_cannot_read_the_finance_summary(): void
    {
        $employee = $this->makeUser('Employee');

        $this->actingAs($employee)->getJson('/api/finance/summary')->assertStatus(403);
    }

    public function test_finance_summary_totals_in_paise(): void
    {
        $finance = $this->makeUser('Finance');
        $this->approvedReport(200075);

        $this->actingAs($finance)->getJson('/api/finance/summary')
            ->assertOk()
            ->assertJsonPath('outstanding_paise', 200075)
            ->assertJsonPath('outstanding_count', 1);
    }

    public function test_recording_a_payment_marks_the_report_paid(): void
    {
        $finance = $this->makeUser('Finance');
        $report = $this->approvedReport();

        $this->actingAs($finance)->postJson('/api/reports/'.$report->id.'/reimbursement', [
            'payment_date' => now()->format('Y-m-d'),
            'payment_reference' => 'NEFT-123',
        ])->assertCreated()
            ->assertJsonPath('data.amount_paise', 200075);

        $this->assertSame(Report::STATUS_PAID, $report->refresh()->status);
        $this->assertDatabaseHas('audit_events', [
            'report_id' => $report->id,
            'action' => 'paid',
            'amount_paise' => 200075,
        ]);
    }

    public function test_a_second_payment_answers_409(): void
    {
        $finance = $this->makeUser('Finance');
        $report = $this->approvedReport();

        $payload = [
            'payment_date' => now()->format('Y-m-d'),
            'payment_reference' => 'NEFT-123',
        ];

        $this->actingAs($finance)->postJson('/api/reports/'.$report->id.'/reimbursement', $payload)
            ->assertCreated();

        $this->actingAs($finance)->postJson('/api/reports/'.$report->id.'/reimbursement', $payload)
            ->assertStatus(409)
            ->assertJsonPath('message', 'This report was already paid');

        $this->assertSame(1, Reimbursement::where('report_id', $report->id)->count());
    }

    public function test_a_future_payment_date_answers_422(): void
    {
        $finance = $this->makeUser('Finance');
        $report = $this->approvedReport();

        $this->actingAs($finance)->postJson('/api/reports/'.$report->id.'/reimbursement', [
            'payment_date' => now()->addDay()->format('Y-m-d'),
            'payment_reference' => 'NEFT-123',
        ])->assertStatus(422)
            ->assertJsonPath('errors.payment_date.0', 'Payment date cannot be in the future');
    }

    public function test_employee_cannot_record_a_payment(): void
    {
        $employee = $this->makeUser('Employee');
        $report = $this->approvedReport();

        $this->actingAs($employee)->postJson('/api/reports/'.$report->id.'/reimbursement', [
            'payment_date' => now()->format('Y-m-d'),
            'payment_reference' => 'NEFT-123',
        ])->assertStatus(403);
    }

    public function test_csv_export_applies_filters_and_writes_safe_required_columns(): void
    {
        $finance = $this->makeUser('Finance');
        $report = $this->approvedReport(200075);
        $report->employee->update(['name' => '+Employee']);
        $report->update(['title' => '-Quarterly report']);

        $this->actingAs($finance)->postJson('/api/reports/'.$report->id.'/reimbursement', [
            'payment_date' => '2026-10-15',
            'payment_reference' => '=NEFT-123',
        ])->assertCreated();

        $outsidePeriod = $this->approvedReport(999);
        $this->actingAs($finance)->postJson('/api/reports/'.$outsidePeriod->id.'/reimbursement', [
            'payment_date' => '2026-09-30',
            'payment_reference' => '@OUTSIDE',
        ])->assertCreated();

        $response = $this->actingAs($finance)->get('/api/finance/export.csv?from=2026-10-01&to=2026-10-31&q=Quarterly');
        $response->assertOk();
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('Content-Type'));
        $rows = array_map('str_getcsv', preg_split('/\r\n|\n|\r/', trim($response->streamedContent())));

        $this->assertSame([
            ['Payment date', 'Payment reference', 'Employee', 'Report title', 'Amount in INR'],
            ['2026-10-15', "'=NEFT-123", "'+Employee", "'-Quarterly report", '2000.75'],
        ], $rows);
    }

    public function test_csv_export_has_only_the_header_when_no_payment_matches(): void
    {
        $finance = $this->makeUser('Finance');

        $response = $this->actingAs($finance)->get('/api/finance/export.csv?from=2026-10-01&to=2026-10-31&q=missing');

        $response->assertOk();
        $this->assertSame(
            ['Payment date', 'Payment reference', 'Employee', 'Report title', 'Amount in INR'],
            str_getcsv(trim($response->streamedContent())),
        );
    }
}
