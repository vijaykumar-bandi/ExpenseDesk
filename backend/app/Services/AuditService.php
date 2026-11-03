<?php

namespace App\Services;

use App\Models\AuditEvent;
use App\Models\Report;
use App\Models\User;

/**
 * Writes audit events inside the caller's transaction. There is no update or
 * delete path: the table is append-only.
 */
class AuditService
{
    public function record(
        Report $report,
        User $actor,
        string $action,
        array $attributes = [],
    ): AuditEvent {
        return AuditEvent::create(array_merge([
            'report_id' => $report->id,
            'actor_id' => $actor->id,
            'action' => $action,
            'created_at' => now(),
        ], $attributes));
    }
}
