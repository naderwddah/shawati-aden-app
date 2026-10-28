<?php

namespace App\Services;

use App\Models\Supplier;
use App\Models\SupplierPayment;
use Illuminate\Support\Facades\DB;

class SupplierPaymentService
{
    public function create(array $data): SupplierPayment
    {
        return DB::transaction(function () use ($data) {

            $supplier = Supplier::findOrFail($data['supplier_id']);

            $payment = SupplierPayment::create([
                'supplier_id' => $supplier->id,
                'amount' => $data['amount'],
                'payment_method_id' => $data['payment_method_id'],
                'payment_date' => $data['payment_date'],
                'notes' => $data['notes'] ?? null,
            ]);

            return $payment->load([
                'supplier',
                'paymentMethod',
            ]);
        });
    }

    /** Update a payment without changing the supplier it belongs to. */
    public function update(SupplierPayment $payment, array $data): SupplierPayment
    {
        return DB::transaction(function () use ($payment, $data) {
            $changes = array_intersect_key($data, array_flip([
                'amount', 'payment_method_id', 'payment_date', 'notes',
            ]));

            $payment->update($changes);

            return $payment->fresh()->load(['supplier', 'paymentMethod']);
        });
    }
}