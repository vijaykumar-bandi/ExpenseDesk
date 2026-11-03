<?php

namespace App\Policies;

use App\Models\Receipt;
use App\Models\User;

class ReceiptPolicy
{
    public function view(User $user, Receipt $receipt): bool
    {
        $receipt->loadMissing('line.report');

        $report = $receipt->line?->report;

        if (! $report) {
            return false;
        }

        if ($user->isAdministrator() || $user->isFinance()) {
            return true;
        }

        return $report->employee_id === $user->id || $report->manager_id === $user->id;
    }
}
