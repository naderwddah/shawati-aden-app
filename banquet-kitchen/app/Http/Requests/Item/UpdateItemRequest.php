<?php

namespace App\Http\Requests\Item;

use Illuminate\Foundation\Http\FormRequest;

class UpdateItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'default_price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'note' => ['nullable', 'string'],
        ];
    }
}   