<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
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
            'login_type' => ['nullable', 'string', 'in:email,voter'],
            'email' => ['nullable', 'required_if:login_type,email', 'string', 'email', 'max:255'],
            'password' => ['nullable', 'required_if:login_type,email', 'string', 'min:8', 'max:255'],
            'voter_id' => ['nullable', 'required_if:login_type,voter', 'string', 'max:100'],
            'voter_key' => ['nullable', 'required_if:login_type,voter', 'string', 'max:255'],
            'remember' => ['sometimes', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('login_type')) {
            $this->merge([
                'login_type' => $this->filled('voter_id') ? 'voter' : 'email',
            ]);
        }
    }
}
