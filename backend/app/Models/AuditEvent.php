<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only: the model has no update or delete path.
 */
class AuditEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'report_id',
        'actor_id',
        'action',
        'from_status',
        'to_status',
        'reason',
        'previous_manager_id',
        'new_manager_id',
        'amount_paise',
        'payment_date',
        'payment_reference',
        'created_at',
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

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function previousManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'previous_manager_id');
    }

    public function newManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'new_manager_id');
    }

    public function toApiArray(): array
    {
        $this->loadMissing(['actor', 'previousManager', 'newManager']);

        return [
            'id' => $this->id,
            'report_id' => $this->report_id,
            'action' => $this->action,
            'actor' => $this->actor ? [
                'id' => $this->actor->id,
                'name' => $this->actor->name,
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
            'from_status' => $this->from_status,
            'to_status' => $this->to_status,
            'reason' => $this->reason,
            'previous_manager' => $this->previousManager ? [
                'id' => $this->previousManager->id,
                'name' => $this->previousManager->name,
            ] : null,
            'new_manager' => $this->newManager ? [
                'id' => $this->newManager->id,
                'name' => $this->newManager->name,
            ] : null,
            'amount_paise' => $this->amount_paise,
            'payment_date' => $this->payment_date?->format('Y-m-d'),
            'payment_reference' => $this->payment_reference,
        ];
    }
}
