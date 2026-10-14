<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListQuoteRequestsRequest extends FormRequest
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
            'search' => ['sometimes', 'nullable', 'string', 'max:150'],
            'status' => [
                'sometimes',
                'nullable',
                Rule::in(['new', 'in_review', 'quoted', 'closed'])
            ],
            'assigned_user_id' => [
                'sometimes',
                'nullable',
                'integer',
                'prohibited_if:unassigned,1',
                'exists:users,id'
            ],
            'unassigned' => ['sometimes', 'boolean'],
            'service_type' => [
                'sometimes',
                'nullable',
                'string',
                'max:100'
            ],
            'sort_by' => [
                'sometimes',
                Rule::in(['id', 'created_at', 'client_name', 'status'])
            ],
            'sort_direction' => [
                'sometimes',
                Rule::in(['asc', 'desc'])
            ],
            'per_page' => [
                'sometimes',
                'integer',
                'between:1,100'
            ]
        ];
    }
}
