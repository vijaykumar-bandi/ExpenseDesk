<?php

namespace App\Http\Requests;

use App\Models\User;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class ReassignRequest extends FormRequest
{
    public function authorize(): bool
    {
        if (! $this->user()?->isAdministrator()) {
            abort(403, 'You do not have access to this page');
        }

        return true;
    }

    public function rules(): array
    {
        return [
            'manager_id' => [
                'required',
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
