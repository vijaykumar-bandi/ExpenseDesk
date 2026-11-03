<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $target = $this->route('user');

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($target instanceof User ? $target->id : $target),
            ],
            'roles' => ['sometimes', 'array', 'min:1'],
            'roles.*' => [Rule::in(User::ROLES)],
            'manager_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'active' => ['sometimes', 'boolean'],
            'password' => ['sometimes', 'string', 'min:12'],
        ];
    }

    public function messages(): array
    {
        return [
            'roles.min' => 'Choose at least one role',
            'password.min' => 'Password must be at least 12 characters',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => strtolower((string) $this->input('email'))]);
        }
    }
}
