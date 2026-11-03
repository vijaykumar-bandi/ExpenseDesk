<?php

namespace Tests\Feature;

use App\Models\Report;
use App\Models\Receipt;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_creates_a_draft_report(): void
    {
        $employee = $this->makeUser('Employee');

        $this->actingAs($employee)->postJson('/api/reports', [
            'title' => 'Trip',
            'business_purpose' => 'Client visit',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.title', 'Trip');
    }

    public function test_report_list_requires_a_session(): void
    {
        $this->getJson('/api/reports')->assertStatus(401);
    }

    public function test_employee_sees_only_own_reports(): void
    {
        $employee = $this->makeUser('Employee');
        $other = $this->makeUser('Employee');

        $mine = $this->makeReport($employee, ['title' => 'Mine']);
        $this->makeReport($other, ['title' => 'Theirs']);

        $this->actingAs($employee)->getJson('/api/reports')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $mine->id);
    }

    public function test_another_employees_report_answers_403(): void
    {
        $employee = $this->makeUser('Employee');
        $other = $this->makeUser('Employee');
        $report = $this->makeReport($other);

        $this->actingAs($employee)->getJson('/api/reports/'.$report->id)
            ->assertStatus(403)
            ->assertJsonPath('message', 'You do not have access to this report');
    }

    public function test_manager_can_view_an_assigned_report(): void
    {
        $manager = $this->makeUser('Manager');
        $employee = $this->makeUser('Employee');
        $report = $this->makeReport($employee, ['manager_id' => $manager->id]);

        $this->actingAs($manager)->getJson('/api/reports/'.$report->id)->assertOk();
    }

    public function test_lines_recompute_the_total_in_paise(): void
    {
        $employee = $this->makeUser('Employee');
        $report = $this->makeReport($employee);
        $category = $this->makeCategory('Travel');

        $this->actingAs($employee)->postJson('/api/reports/'.$report->id.'/lines', [
            'expense_date' => now()->subDay()->format('Y-m-d'),
            'category_id' => $category->id,
            'merchant' => 'IndiGo',
            'amount_paise' => 75050,
        ])->assertCreated();

        $this->actingAs($employee)->postJson('/api/reports/'.$report->id.'/lines', [
            'expense_date' => now()->subDay()->format('Y-m-d'),
            'category_id' => $category->id,
            'merchant' => 'Taj',
            'amount_paise' => 125025,
        ])->assertCreated();

        $this->assertSame(200075, $report->refresh()->total_paise);
    }

    public function test_a_future_expense_date_answers_422(): void
    {
        $employee = $this->makeUser('Employee');
        $report = $this->makeReport($employee);
        $category = $this->makeCategory('Travel');

        $this->actingAs($employee)->postJson('/api/reports/'.$report->id.'/lines', [
            'expense_date' => now()->addDay()->format('Y-m-d'),
            'category_id' => $category->id,
            'merchant' => 'IndiGo',
            'amount_paise' => 100,
        ])->assertStatus(422)
            ->assertJsonPath('errors.expense_date.0', 'Expense date cannot be in the future');
    }

    public function test_a_zero_amount_answers_422(): void
    {
        $employee = $this->makeUser('Employee');
        $report = $this->makeReport($employee);
        $category = $this->makeCategory('Travel');

        $this->actingAs($employee)->postJson('/api/reports/'.$report->id.'/lines', [
            'expense_date' => now()->subDay()->format('Y-m-d'),
            'category_id' => $category->id,
            'merchant' => 'IndiGo',
            'amount_paise' => 0,
        ])->assertStatus(422)
            ->assertJsonPath('errors.amount_paise.0', 'Amount must be greater than zero');
    }

    public function test_submit_without_a_receipt_answers_422(): void
    {
        $employee = $this->makeUser('Employee');
        $report = $this->makeReport($employee);
        $this->makeLine($report);

        $this->actingAs($employee)->postJson('/api/reports/'.$report->id.'/submit')
            ->assertStatus(422)
            ->assertJsonPath('errors.lines.0.receipt.0', 'Receipt required');
    }

    public function test_submit_with_receipts_writes_the_audit_event(): void
    {
        Storage::fake('receipts');

        $manager = $this->makeUser('Manager');
        $employee = $this->makeUser('Employee', ['manager_id' => $manager->id]);
        $report = $this->makeReport($employee);
        $line = $this->makeLine($report, 75050);

        $this->actingAs($employee)
            ->post('/api/reports/'.$report->id.'/lines/'.$line->id.'/receipt', [
                'file' => UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf'),
            ])->assertCreated();

        $this->actingAs($employee)->postJson('/api/reports/'.$report->id.'/submit')
            ->assertOk()
            ->assertJsonPath('data.status', 'submitted')
            ->assertJsonPath('data.manager.id', $manager->id);

        $this->assertDatabaseHas('audit_events', [
            'report_id' => $report->id,
            'action' => 'submitted',
            'to_status' => 'submitted',
        ]);
    }

    public function test_a_receipt_that_is_not_a_pdf_jpeg_or_png_answers_422(): void
    {
        Storage::fake('receipts');

        $employee = $this->makeUser('Employee');
        $report = $this->makeReport($employee);
        $line = $this->makeLine($report);

        $this->actingAs($employee)
            ->post('/api/reports/'.$report->id.'/lines/'.$line->id.'/receipt', [
                'file' => UploadedFile::fake()->create('notes.txt', 10, 'text/plain'),
            ])->assertStatus(422)
            ->assertJsonPath('errors.file.0', 'Receipts must be a PDF, JPEG or PNG of up to 5 MB');
    }

    public function test_receipt_download_checks_access(): void
    {
        Storage::fake('receipts');

        $owner = $this->makeUser('Employee');
        $other = $this->makeUser('Employee');
        $report = $this->makeReport($owner);
        $line = $this->makeLine($report);

        $this->actingAs($owner)
            ->post('/api/reports/'.$report->id.'/lines/'.$line->id.'/receipt', [
                'file' => UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf'),
            ])->assertCreated();

        $receipt = Receipt::firstOrFail();

        $this->actingAs($other)->getJson('/api/receipts/'.$receipt->id)
            ->assertStatus(403)
            ->assertJsonPath('message', 'You do not have access to this report');

        $this->actingAs($owner)->get('/api/receipts/'.$receipt->id)->assertOk();
    }

    public function test_a_paid_report_cannot_be_edited(): void
    {
        $employee = $this->makeUser('Employee');
        $report = $this->makeReport($employee, ['status' => Report::STATUS_PAID]);

        $this->actingAs($employee)->patchJson('/api/reports/'.$report->id, ['title' => 'New'])
            ->assertStatus(403);
    }

    public function test_audit_history_is_append_only(): void
    {
        $admin = $this->makeUser('Administrator');

        $this->actingAs($admin)->patchJson('/api/audit-events/1', ['action' => 'x'])
            ->assertStatus(405);
        $this->actingAs($admin)->deleteJson('/api/audit-events/1')->assertStatus(405);
    }
}
