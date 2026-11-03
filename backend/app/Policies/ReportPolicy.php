<?php

namespace App\Policies;

use App\Models\Report;
use App\Models\User;

class ReportPolicy
{
    /**
     * The message a denied request answers with.
     */
    public const DENIED_MESSAGE = 'You do not have access to this report';

    public function view(User $user, Report $report): bool
    {
        if ($user->isAdministrator() || $user->isFinance()) {
            return true;
        }

        if ($report->employee_id === $user->id) {
            return true;
        }

        return $report->manager_id === $user->id;
    }

    public function update(User $user, Report $report): bool
    {
        return $report->employee_id === $user->id && $report->isEditable();
    }

    public function submit(User $user, Report $report): bool
    {
        return $report->employee_id === $user->id && $report->isEditable();
    }

    public function decide(User $user, Report $report): bool
    {
        if ($report->employee_id === $user->id) {
            return false;
        }

        return $report->manager_id === $user->id || $user->isAdministrator();
    }

    public function reassign(User $user, Report $report): bool
    {
        return $user->isAdministrator();
    }

    public function pay(User $user, Report $report): bool
    {
        return $user->isFinance();
    }
}
