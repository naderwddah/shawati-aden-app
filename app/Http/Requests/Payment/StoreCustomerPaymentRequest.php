<?php

namespace App\Http\Requests\Payment;

use Illuminate\Foundation\Http\FormRequest;

class StoreCustomerPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'booking_id' => ['nullable', 'integer', 'exists:bookings,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'payment_date' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ];
    }
}