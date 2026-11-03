<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReassignRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'manager_id' => ['required', 'integer', 'exists:users,id'],
            'reason' => ['required', 'string', 'min:10'],
        ];
    }

    public function messages(): array
    {
        return [
            'reason.min' => 'Reason must be at least 10 characters',
        ];
    }
}
