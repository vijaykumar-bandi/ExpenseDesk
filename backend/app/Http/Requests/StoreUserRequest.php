<?php

namespace App\Http\Requests;

use App\Models\User;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => [Rule::in(User::ROLES)],
            'password' => ['required', 'string', 'min:12'],
            'manager_id' => [
                'nullable',
                'integer',
                function (string $attribute, mixed $value, Closure $fail): void {
                    $isActiveManager = User::query()
                        ->whereKey($value)
                        ->where('active', true)
                        ->whereHas('roles', fn ($query) => $query->where('name', User::ROLE_MANAGER))
                        ->exists();

                    if (! $isActiveManager) {
                        $fail('The selected manager must be an active Manager');
                    }
                },
            ],
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
