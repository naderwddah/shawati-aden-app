<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Customer;
use App\Models\CustomerPayment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BookingService
{
    /**
     * إنشاء حجز جديد.
     *
     * يمكن:
     * 1. استخدام customer_id لعميل موجود.
     * 2. أو إنشاء عميل جديد باستخدام customer_name و customer_phone.
     *
     * العملية كاملة داخل Transaction.
     */
    public function create(array $data): Booking
    {
        return DB::transaction(function () use ($data) {

            /*
             * تحديد العميل
             */
            $customer = $this->resolveCustomer($data);

            /*
             * حساب إجمالي العناصر من السيرفر
             */
            $items = $data['items'];
            $totalAmount = 0;

            foreach ($items as $item) {
                $quantity = (float) $item['quantity'];
                $unitPrice = (float) $item['unit_price'];

                $totalPrice = round($quantity * $unitPrice, 2);

                $totalAmount += $totalPrice;
            }

            $totalAmount = round($totalAmount, 2);

            /*
             * التحقق من التأمين المرتجع
             */
            $plateDeposit = isset($data['plate_deposit'])
                ? (float) $data['plate_deposit']
                : null;

            $plateDepositReturned = isset($data['plate_deposit_returned'])
                ? (float) $data['plate_deposit_returned']
                : null;

            if (
                $plateDepositReturned !== null &&
                (
                    $plateDeposit === null ||
                    $plateDepositReturned > $plateDeposit
                )
            ) {
                throw ValidationException::withMessages([
                    'plate_deposit_returned' =>
                        'مبلغ التأمين المرتجع لا يمكن أن يتجاوز مبلغ التأمين.',
                ]);
            }

            /*
             * إنشاء الحجز
             */
            $booking = Booking::create([
                'customer_id' => $customer->id,
                'invoice_date' => $data['invoice_date'],
                'event_date' => $data['event_date'],
                'delivery_time' => $data['delivery_time'],
                'delivery_period' => $data['delivery_period'],
                'delivery_address' => $data['delivery_address'],
                'mark' => $data['mark'] ?? null,

                // الإجمالي يحسب من العناصر وليس من frontend
                'total_amount' => $totalAmount,

                'plate_deposit' => $plateDeposit,
                'plate_deposit_returned' => $plateDepositReturned,

                'status' => $data['status'] ?? 'new',
                'notes' => $data['notes'] ?? null,
            ]);

            /*
             * حفظ عناصر الحجز كـ Snapshot
             */
            foreach ($items as $item) {
                $quantity = (float) $item['quantity'];
                $unitPrice = (float) $item['unit_price'];

                $totalPrice = round($quantity * $unitPrice, 2);

                BookingItem::create([
                    'booking_id' => $booking->id,
                    'item_name' => $item['item_name'],
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'total_price' => $totalPrice,
                ]);
            }

            /*
             * إنشاء الدفعة الأولى إن وجدت
             */
            if (!empty($data['initial_payment'])) {

                $initialPayment = (float) $data['initial_payment'];

                if ($initialPayment > $totalAmount) {
                    throw ValidationException::withMessages([
                        'initial_payment' =>
                            'الدفعة الأولى لا يمكن أن تتجاوز إجمالي الفاتورة.',
                    ]);
                }

                CustomerPayment::create([
                    'customer_id' => $customer->id,
                    'booking_id' => $booking->id,
                    'amount' => $initialPayment,
                    'payment_method_id' => $data['payment_method_id'],
                    'payment_date' => now(),
                    'notes' => $data['payment_notes'] ?? null,
                ]);
            }

            /*
             * إعادة الحجز مع العلاقات المطلوبة
             */
            return $booking->load([
                'customer',
                'items',
                'payments',
            ]);
        });
    }

    /**
     * تحديد العميل أو إنشاء عميل جديد.
     */
    private function resolveCustomer(array $data): Customer
    {
        /*
         * عميل موجود
         */
        if (!empty($data['customer_id'])) {
            return Customer::findOrFail($data['customer_id']);
        }

        /*
         * عميل جديد
         */
        if (
            empty($data['customer_name']) ||
            empty($data['customer_phone'])
        ) {
            throw ValidationException::withMessages([
                'customer' =>
                    'يجب اختيار عميل موجود أو إدخال اسم ورقم هاتف العميل الجديد.',
            ]);
        }

        return Customer::create([
            'name' => $data['customer_name'],
            'phone' => $data['customer_phone'],
            'notes' => $data['customer_notes'] ?? null,
            'is_active' => true,
        ]);
    }
}