<?php

namespace App\Services;

use App\Models\Report;
use App\Models\Reimbursement;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReimbursementService
{
    public function __construct(private AuditService $audit)
    {
    }

    /**
     * Records the single payment for an approved report. The conditional update
     * plus the unique index on reimbursements.report_id make a double-click, a
     * retry or two Finance users at once create exactly one reimbursement.
     */
    public function record(Report $report, User $actor, string $paymentDate, string $paymentReference): Reimbursement
    {
        try {
            return DB::transaction(function () use ($report, $actor, $paymentDate, $paymentReference) {
                $updated = Report::whereKey($report->id)
                    ->where('status', Report::STATUS_APPROVED)
                    ->update([
                        'status' => Report::STATUS_PAID,
                        'paid_at' => now(),
                        'updated_at' => now(),
                    ]);

                if (! $updated) {
                    throw new \App\Exceptions\ReportConflictException(
                        'This report was already paid',
                        $report->refresh(),
                    );
                }

                $reimbursement = Reimbursement::create([
                    'report_id' => $report->id,
                    'amount_paise' => (int) $report->total_paise,
                    'payment_date' => $paymentDate,
                    'payment_reference' => $paymentReference,
                    'recorded_by' => $actor->id,
                    'created_at' => now(),
                ]);

                $report->refresh();

                $this->audit->record($report, $actor, 'paid', [
                    'from_status' => Report::STATUS_APPROVED,
                    'to_status' => Report::STATUS_PAID,
                    'amount_paise' => (int) $report->total_paise,
                    'payment_date' => $paymentDate,
                    'payment_reference' => $paymentReference,
                ]);

                return $reimbursement;
            });
        } catch (QueryException $e) {
            if ($this->isUniqueViolation($e)) {
                throw new \App\Exceptions\ReportConflictException(
                    'This report was already paid',
                    $report->refresh(),
                );
            }

            throw $e;
        }
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $message = $e->getMessage();

        return str_contains($message, 'UNIQUE constraint failed')
            || str_contains($message, 'Duplicate entry');
    }
}
