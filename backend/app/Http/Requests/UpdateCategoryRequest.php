<?php

namespace App\Http\Requests;

use App\Models\Category;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdministrator() ?? false;
    }

    protected function failedAuthorization(): void
    {
        throw new AuthorizationException('You do not have access to this page');
    }

    public function rules(): array
    {
        $target = $this->route('category');

        return [
            'name' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('categories', 'name')->ignore($target instanceof Category ? $target->id : $target),
            ],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
