<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ReportLine extends Model
{
    protected $fillable = [
        'report_id',
        'expense_date',
        'category_id',
        'merchant',
        'amount_paise',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'expense_date' => 'date:Y-m-d',
            'amount_paise' => 'integer',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function receipt(): HasOne
    {
        return $this->hasOne(Receipt::class);
    }

    public function toApiArray(): array
    {
        $this->loadMissing(['category', 'receipt']);

        return [
            'id' => $this->id,
            'expense_date' => $this->expense_date?->format('Y-m-d'),
            'category' => $this->category ? [
                'id' => $this->category->id,
                'name' => $this->category->name,
            ] : null,
            'merchant' => $this->merchant,
            'amount_paise' => $this->amount_paise === null ? null : (int) $this->amount_paise,
            'note' => $this->note,
            'receipt' => $this->receipt ? [
                'id' => $this->receipt->id,
                'file_name' => $this->receipt->file_name,
                'mime_type' => $this->receipt->mime_type,
                'size' => (int) $this->receipt->size,
            ] : null,
        ];
    }
}
