<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreQuoteRequestRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email:rfc', 'max:255'],
            'company' => ['nullable', 'string', 'max:150'],
            'service_type' => ['required', 'string', 'max:100'],
            'budget_range' => [
                'required',
                Rule::in([
                    'under_1000',
                    '1000_5000',
                    '5000_10000',
                    'above_10000',
                    'not_sure'
                ])
            ],
            'message' => ['required', 'string', 'min:10', 'max:5000'],
            'website' => ['prohibited'],
            'status' => ['prohibited'],
            'assigned_user_id' => ['prohibited']
        ];
    }
}
