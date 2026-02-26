<?php

namespace App\Http\Requests\Position;

use Illuminate\Foundation\Http\FormRequest;

class StorePositionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'max_votes_allowed' => ['required', 'integer', 'min:1', 'max:100', 'gte:min_votes_allowed'],
            'min_votes_allowed' => ['required', 'integer', 'min:1', 'max:100', 'lte:max_votes_allowed'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('max_votes_allowed')) {
            $this->merge([
                'max_votes_allowed' => 1,
            ]);
        }

        if (! $this->filled('min_votes_allowed')) {
            $this->merge([
                'min_votes_allowed' => 1,
            ]);
        }
    }
}
