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
        $draft = $this->boolean('draft');
        $todayInKolkata = now(config('expensedesk.timezone', 'Asia/Kolkata'))->toDateString();

        return [
            'expense_date' => ['sometimes', $draft ? 'nullable' : 'required', 'date', $draft ? null : 'before_or_equal:'.$todayInKolkata],
            'category_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('categories', 'id'),
            ],
            'merchant' => ['sometimes', 'nullable', 'string', 'max:255'],
            'amount_paise' => ['sometimes', $draft ? 'nullable' : 'required', 'integer', $draft ? null : 'min:1'],
            'note' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'draft' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'expense_date.before_or_equal' => 'Expense date cannot be in the future',
            'amount_paise.min' => 'Amount must be more than zero',
        ];
    }
}
