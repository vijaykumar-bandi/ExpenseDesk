<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLineRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'expense_date' => ['required', 'date', 'before_or_equal:today'],
            'category_id' => [
                'required',
                'integer',
                Rule::exists('categories', 'id')->where('active', true),
            ],
            'merchant' => ['required', 'string', 'max:255'],
            'amount_paise' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'expense_date.before_or_equal' => 'Expense date cannot be in the future',
            'amount_paise.min' => 'Amount must be greater than zero',
            'category_id.exists' => 'Choose an active category',
        ];
    }
}
