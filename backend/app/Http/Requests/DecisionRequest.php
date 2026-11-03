<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DecisionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::in(['approve', 'request_changes', 'reject'])],
            'reason' => [
                Rule::requiredIf(fn () => in_array($this->input('decision'), ['request_changes', 'reject'], true)),
                'nullable',
                'string',
                'min:10',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.min' => 'Reason must be at least 10 characters',
            'reason.required' => 'Reason must be at least 10 characters',
        ];
    }
}
