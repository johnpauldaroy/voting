<?php

namespace App\Http\Requests\Vote;

use Illuminate\Foundation\Http\FormRequest;

class StoreVoteRequest extends FormRequest
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
            'election_id' => ['required', 'integer', 'exists:elections,id'],
            'votes' => ['required', 'array', 'min:1'],
            'votes.*.position_id' => ['required', 'integer', 'exists:positions,id'],
            'votes.*.candidate_id' => ['required', 'integer', 'exists:candidates,id'],
        ];
    }
}
