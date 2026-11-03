<?php

namespace App\Exceptions;

use App\Models\Report;
use RuntimeException;

class ReportConflictException extends RuntimeException
{
    public function __construct(string $message, public Report $report)
    {
        parent::__construct($message);
    }
}
