<?php

namespace App\Services;

use App\Models\Supplier;
use App\Models\SupplierInvoice;
use Illuminate\Support\Facades\DB;

class SupplierInvoiceService
{
    public function create(array $data): SupplierInvoice
    {
        return DB::transaction(function () use ($data) {

            $supplier = Supplier::findOrFail($data['supplier_id']);

            $invoice = SupplierInvoice::create([
                'supplier_id' => $supplier->id,
                'invoice_number' => $data['invoice_number'] ?? null,
                'invoice_date' => $data['invoice_date'],
                'details' => $data['details'],
                'total_amount' => $data['total_amount'],
                'notes' => $data['notes'] ?? null,
            ]);

            return $invoice->load('supplier');
        });
    }

    public function update(
        SupplierInvoice $invoice,
        array $data
    ): SupplierInvoice {
        return DB::transaction(function () use ($invoice, $data) {

            if (isset($data['supplier_id'])) {
                Supplier::findOrFail($data['supplier_id']);
            }

            $invoice->update([
                'supplier_id' => $data['supplier_id'] ?? $invoice->supplier_id,
                'invoice_number' => array_key_exists('invoice_number', $data)
                    ? $data['invoice_number']
                    : $invoice->invoice_number,
                'invoice_date' => $data['invoice_date'] ?? $invoice->invoice_date,
                'details' => $data['details'] ?? $invoice->details,
                'total_amount' => $data['total_amount'] ?? $invoice->total_amount,
                'notes' => array_key_exists('notes', $data)
                    ? $data['notes']
                    : $invoice->notes,
            ]);

            return $invoice->fresh()->load('supplier');
        });
    }
}