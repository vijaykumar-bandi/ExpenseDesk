<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Report extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_CHANGES_REQUESTED = 'changes_requested';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_PAID = 'paid';

    protected $fillable = [
        'employee_id',
        'manager_id',
        'title',
        'business_purpose',
        'status',
        'total_paise',
        'submitted_at',
        'decided_at',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'total_paise' => 'integer',
            'submitted_at' => 'datetime',
            'decided_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(ReportLine::class);
    }

    public function reimbursement(): HasOne
    {
        return $this->hasOne(Reimbursement::class);
    }

    public function auditEvents(): HasMany
    {
        return $this->hasMany(AuditEvent::class);
    }

    public function isEditable(): bool
    {
        return in_array($this->status, [self::STATUS_DRAFT, self::STATUS_CHANGES_REQUESTED], true);
    }

    public function waitingDays(): int
    {
        if (! $this->submitted_at) {
            return 0;
        }

        $tz = config('expensedesk.timezone', 'Asia/Kolkata');

        return (int) $this->submitted_at->copy()->setTimezone($tz)->startOfDay()
            ->diffInDays(now($tz)->startOfDay());
    }

    public function toSummaryArray(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'status' => $this->status,
            'total_paise' => (int) $this->total_paise,
            'updated_at' => $this->updated_at?->toIso8601String(),
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'employee' => $this->employee ? [
                'id' => $this->employee->id,
                'name' => $this->employee->name,
            ] : null,
            'manager' => $this->manager ? [
                'id' => $this->manager->id,
                'name' => $this->manager->name,
            ] : null,
            'waiting_days' => $this->waitingDays(),
        ];
    }

    public function toApiArray(): array
    {
        $this->loadMissing(['employee', 'manager', 'lines.category', 'lines.receipt', 'reimbursement', 'auditEvents.actor']);

        return [
            'id' => $this->id,
            'title' => $this->title,
            'business_purpose' => $this->business_purpose,
            'status' => $this->status,
            'total_paise' => (int) $this->total_paise,
            'employee' => $this->employee ? [
                'id' => $this->employee->id,
                'name' => $this->employee->name,
            ] : null,
            'manager' => $this->manager ? [
                'id' => $this->manager->id,
                'name' => $this->manager->name,
            ] : null,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'decided_at' => $this->decided_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'lines' => $this->lines->map(fn (ReportLine $line) => $line->toApiArray())->values()->all(),
            'reimbursement' => $this->reimbursement?->toApiArray(),
            'audit' => $this->auditEvents->sortByDesc('id')->map(fn (AuditEvent $e) => $e->toApiArray())->values()->all(),
        ];
    }
}
