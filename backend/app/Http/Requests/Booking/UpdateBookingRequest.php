<?php

namespace App\Http\Requests\Booking;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['sometimes', 'required', 'integer', 'exists:customers,id'],

            'invoice_date' => ['sometimes', 'required', 'date'],
            'event_date' => ['sometimes', 'required', 'date'],
            'delivery_time' => ['sometimes', 'required', 'date_format:H:i'],
            'delivery_period' => ['sometimes', 'required', 'string', 'max:20'],
            'delivery_address' => ['sometimes', 'required', 'string'],
            'mark' => ['nullable', 'string', 'max:255'],

            'total_amount' => ['sometimes', 'required', 'numeric', 'min:0'],

            'plate_deposit' => ['nullable', 'numeric', 'min:0'],
            'plate_deposit_returned' => ['nullable', 'numeric', 'min:0'],

            'status' => ['sometimes', 'required', 'string', 'max:20'],
            'notes' => ['nullable', 'string'],

            'items' => ['sometimes', 'required', 'array', 'min:1'],
            'items.*.item_name' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.total_price' => ['required', 'numeric', 'min:0'],
        ];
    }
}