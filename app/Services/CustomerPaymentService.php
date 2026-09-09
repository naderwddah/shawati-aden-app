<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\CustomerPayment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CustomerPaymentService
{
    public function create(array $data): CustomerPayment
    {
        return DB::transaction(function () use ($data) {

            $customer = Customer::findOrFail($data['customer_id']);

            /*
             * إذا كانت الدفعة مرتبطة بفاتورة معينة،
             * يجب أن تكون الفاتورة لنفس العميل.
             */
            if (!empty($data['booking_id'])) {
                $booking = Booking::findOrFail($data['booking_id']);

                if ((int) $booking->customer_id !== (int) $customer->id) {
                    throw ValidationException::withMessages([
                        'booking_id' =>
                            'الفاتورة المحددة لا تتبع لهذا العميل.',
                    ]);
                }
            }

            $payment = CustomerPayment::create([
                'customer_id' => $customer->id,
                'booking_id' => $data['booking_id'] ?? null,
                'amount' => $data['amount'],
                'payment_method_id' => $data['payment_method_id'],
                'payment_date' => $data['payment_date'],
                'notes' => $data['notes'] ?? null,
            ]);

            return $payment->load([
                'customer',
                'booking',
                'paymentMethod',
            ]);
        });
    }
}