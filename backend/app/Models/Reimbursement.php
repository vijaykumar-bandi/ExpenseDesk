<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reimbursement extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'report_id',
        'amount_paise',
        'payment_date',
        'payment_reference',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'amount_paise' => 'integer',
            'payment_date' => 'date:Y-m-d',
            'created_at' => 'datetime',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function toApiArray(): array
    {
        $this->loadMissing(['report.employee', 'recordedBy']);

        return [
            'id' => $this->id,
            'report_id' => $this->report_id,
            'amount_paise' => (int) $this->amount_paise,
            'payment_date' => $this->payment_date?->format('Y-m-d'),
            'payment_reference' => $this->payment_reference,
            'employee' => $this->report?->employee ? [
                'id' => $this->report->employee->id,
                'name' => $this->report->employee->name,
            ] : null,
            'report_title' => $this->report?->title,
            'recorded_by' => $this->recordedBy ? [
                'id' => $this->recordedBy->id,
                'name' => $this->recordedBy->name,
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
