<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLineRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'expense_date' => ['sometimes', 'date', 'before_or_equal:today'],
            'category_id' => [
                'sometimes',
                'integer',
                Rule::exists('categories', 'id'),
            ],
            'merchant' => ['sometimes', 'string', 'max:255'],
            'amount_paise' => ['sometimes', 'integer', 'min:1'],
            'note' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'expense_date.before_or_equal' => 'Expense date cannot be in the future',
            'amount_paise.min' => 'Amount must be greater than zero',
        ];
    }
}
