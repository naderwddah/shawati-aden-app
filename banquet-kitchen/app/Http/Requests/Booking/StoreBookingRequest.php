<?php

namespace App\Http\Requests\Booking;

use Illuminate\Foundation\Http\FormRequest;

class StoreBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // العميل: إما customer_id أو بيانات عميل جديد
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'customer_name' => ['nullable', 'string', 'max:150'],
            'customer_phone' => ['nullable', 'string', 'max:30'],

            'invoice_date' => ['required', 'date'],
            'event_date' => ['required', 'date'],
            'delivery_time' => ['required', 'date_format:H:i'],
            'delivery_period' => ['required', 'string', 'max:20'],
            'delivery_address' => ['required', 'string'],
            'mark' => ['nullable', 'string', 'max:255'],

            'total_amount' => ['required', 'numeric', 'min:0'],

            'plate_deposit' => ['nullable', 'numeric', 'min:0'],
            'plate_deposit_returned' => ['nullable', 'numeric', 'min:0'],

            'status' => ['sometimes', 'string', 'max:20'],
            'notes' => ['nullable', 'string'],

            // عناصر الفاتورة
            'items' => ['required', 'array', 'min:1'],
            'items.*.item_name' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.total_price' => ['required', 'numeric', 'min:0'],

            // الدفعة الأولى - اختيارية
            'initial_payment' => ['nullable', 'numeric', 'gt:0'],
            'payment_method_id' => [
                'required_with:initial_payment',
                'nullable',
                'integer',
                'exists:payment_methods,id',
            ],
            'payment_notes' => ['nullable', 'string'],
        ];
    }
}