<?php

namespace App\Services;

use App\Models\Report;
use App\Models\ReportLine;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReportService
{
    public function __construct(private AuditService $audit)
    {
    }

    public function recomputeTotal(Report $report): Report
    {
        $total = (int) $report->lines()->sum('amount_paise');
        $report->forceFill(['total_paise' => $total])->save();

        return $report;
    }

    /** Submits a complete report and writes its audit event transactionally. */
    public function submit(Report $report, User $actor): Report
    {
        return DB::transaction(function () use ($report, $actor) {
            $report->load('lines.receipt');

            $errors = [];
            $todayInKolkata = now(config('expensedesk.timezone', 'Asia/Kolkata'))->toDateString();
            foreach ($report->lines->values() as $index => $line) {
                if (! $line->expense_date) {
                    $errors['lines'][$index]['expense_date'] = ['Required'];
                } elseif ($line->expense_date->toDateString() > $todayInKolkata) {
                    $errors['lines'][$index]['expense_date'] = ['Expense date cannot be in the future'];
                }
                if (! $line->category_id) {
                    $errors['lines'][$index]['category_id'] = ['Required'];
                }
                if (! trim((string) $line->merchant)) {
                    $errors['lines'][$index]['merchant'] = ['Required'];
                }
                if ($line->amount_paise === null) {
                    $errors['lines'][$index]['amount_paise'] = ['Required'];
                } elseif ($line->amount_paise <= 0) {
                    $errors['lines'][$index]['amount_paise'] = ['Amount must be more than zero'];
                }
                if ($line->amount_paise >= 100000 && ! $line->receipt) {
                    $errors['lines'][$index]['receipt'] = ['Receipt required'];
                }
            }

            if ($report->lines->isEmpty()) {
                $errors['lines'] = ['Add at least one expense line before submitting'];
            }

            if ($errors) {
                throw ValidationException::withMessages($errors);
            }

            $managerId = $report->employee?->manager_id;

            $updated = Report::whereKey($report->id)
                ->whereIn('status', [Report::STATUS_DRAFT, Report::STATUS_CHANGES_REQUESTED])
                ->update([
                    'status' => Report::STATUS_SUBMITTED,
                    'manager_id' => $managerId,
                    'submitted_at' => now(),
                    'decided_at' => null,
                    'total_paise' => (int) $report->lines()->sum('amount_paise'),
                    'updated_at' => now(),
                ]);

            if (! $updated) {
                throw ValidationException::withMessages([
                    'status' => ['This report can no longer be submitted'],
                ]);
            }

            $report->refresh();

            $this->audit->record($report, $actor, 'submitted', [
                'from_status' => Report::STATUS_DRAFT,
                'to_status' => Report::STATUS_SUBMITTED,
            ]);

            return $report;
        });
    }

    public function decide(Report $report, User $actor, string $decision, ?string $reason): Report
    {
        $toStatus = match ($decision) {
            'approve' => Report::STATUS_APPROVED,
            'request_changes' => Report::STATUS_CHANGES_REQUESTED,
            'reject' => Report::STATUS_REJECTED,
        };

        return DB::transaction(function () use ($report, $actor, $decision, $reason, $toStatus) {
            $fromStatus = $report->status;

            $updated = Report::whereKey($report->id)
                ->where('status', Report::STATUS_SUBMITTED)
                ->update([
                    'status' => $toStatus,
                    'decided_at' => now(),
                    'updated_at' => now(),
                ]);

            if (! $updated) {
                $report->refresh();
                $decider = $report->manager?->name ?? 'someone else';

                return throw new \App\Exceptions\ReportConflictException(
                    "This report was already decided by {$decider} as {$report->status}",
                    $report,
                );
            }

            $report->refresh();

            $this->audit->record($report, $actor, $decision === 'request_changes' ? 'changes_requested' : ($decision === 'approve' ? 'approved' : 'rejected'), [
                'from_status' => $fromStatus,
                'to_status' => $toStatus,
                'reason' => $reason,
            ]);

            return $report;
        });
    }

    public function reassign(Report $report, User $actor, int $managerId, string $reason): Report
    {
        return DB::transaction(function () use ($report, $actor, $managerId, $reason) {
            $report = Report::query()->lockForUpdate()->findOrFail($report->id);

            if ($report->status !== Report::STATUS_SUBMITTED) {
                throw ValidationException::withMessages([
                    'report' => ['Only Submitted reports can be reassigned'],
                ]);
            }

            $managerIsEligible = User::query()
                ->whereKey($managerId)
                ->where('active', true)
                ->whereHas('roles', fn ($query) => $query->where('name', User::ROLE_MANAGER))
                ->exists();

            if (! $managerIsEligible) {
                throw ValidationException::withMessages([
                    'manager_id' => ['The selected manager must be an active Manager'],
                ]);
            }

            $previous = $report->manager_id;
            $report->forceFill(['manager_id' => $managerId])->save();

            $this->audit->record($report, $actor, 'reassigned', [
                'from_status' => $report->status,
                'to_status' => $report->status,
                'reason' => $reason,
                'previous_manager_id' => $previous,
                'new_manager_id' => $managerId,
            ]);

            return $report->refresh();
        });
    }

    public function lineBelongsToReport(Report $report, ReportLine $line): bool
    {
        return $line->report_id === $report->id;
    }
}
