<?php

namespace App\Http\Requests\Election;

use Illuminate\Foundation\Http\FormRequest;

class UpdateElectionRequest extends FormRequest
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
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'start_datetime' => ['sometimes', 'date'],
            'end_datetime' => ['sometimes', 'date', 'after:start_datetime'],
            'status' => ['sometimes', 'in:draft,open,closed'],
        ];
    }
}
