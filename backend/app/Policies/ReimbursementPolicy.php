<?php

namespace App\Policies;

use App\Models\Report;
use App\Models\User;

class ReimbursementPolicy
{
    public function create(User $user, Report $report): bool
    {
        return $user->isFinance();
    }
}
