<?php

namespace App\Http\Requests\SupplierInvoice;

use Illuminate\Foundation\Http\FormRequest;

class StoreSupplierInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'invoice_number' => ['nullable', 'string', 'max:100'],
            'invoice_date' => ['required', 'date'],
            'details' => ['required', 'string'],
            'total_amount' => ['required', 'numeric', 'gt:0'],
            'notes' => ['nullable', 'string'],
        ];
    }
}