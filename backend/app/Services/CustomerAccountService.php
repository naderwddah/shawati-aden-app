<?php

namespace App\Services;

use App\Models\Customer;
use Illuminate\Support\Collection;

class CustomerAccountService
{
    /**
     * حساب العميل:
     * إجمالي الأصناف + التأمين القابل للاسترداد - إجمالي الدفعات.
     * الإرجاع يُخزن تراكميًا في plate_deposit_returned؛ لذلك يعرض
     * net_invoices_total وnet_collected_total صافي الطرفين بعد الاسترداد.
     * يُحافَظ على سياسة الحجوزات الملغاة القديمة كما هي دون حذف الرصيد.
     */
    public function getAccount(Customer $customer): array
    {
        $invoicesTotal = (float) $customer->bookings()->sum('total_amount')
            + (float) $customer->bookings()->sum('plate_deposit');
        $depositReturned = (float) $customer->bookings()->sum('plate_deposit_returned');

        $paymentsTotal = (float) $customer->payments()->sum('amount');

        $balance = round($invoicesTotal - $paymentsTotal, 2);

        return [
            'customer' => $customer,
            'invoices_total' => $invoicesTotal,
            'invoices_count' => $customer->bookings()->count(),
            'deposit_returned_total' => round($depositReturned, 2),
            'net_invoices_total' => round($invoicesTotal - $depositReturned, 2),
            'net_collected_total' => round($paymentsTotal - $depositReturned, 2),
            'payments_total' => $paymentsTotal,
            'balance' => $balance,
            'balance_type' => $this->getBalanceType($balance),
        ];
    }

    /**
     * كشف حساب العميل بالتفصيل.
     */
    public function getStatement(Customer $customer): array
    {
        $bookings = $customer->bookings()
            ->orderBy('invoice_date')
            ->get();

        $payments = $customer->payments()
            ->with(['paymentMethod', 'booking'])
            ->orderBy('payment_date')
            ->get();

        $transactions = collect();

        foreach ($bookings as $booking) {
            $transactions->push([
                'type' => 'invoice',
                'id' => $booking->id,
                'date' => $booking->invoice_date,
                'description' => 'فاتورة حجز #' . $booking->id,
                'debit' => round((float) $booking->total_amount + (float) ($booking->plate_deposit ?? 0), 2),
                'credit' => 0,
            ]);
        }

        foreach ($payments as $payment) {
            $transactions->push([
                'type' => 'payment',
                'id' => $payment->id,
                'date' => $payment->payment_date,
                'description' => 'دفعة',
                'debit' => 0,
                'credit' => (float) $payment->amount,
                'payment_method' => $payment->paymentMethod?->name,
                'booking_id' => $payment->booking_id,
            ]);
        }

        $transactions = $transactions
            ->sortBy('date')
            ->values();

        $runningBalance = 0;

        $transactions = $transactions->map(function (array $transaction) use (&$runningBalance) {
            $runningBalance += $transaction['debit'];
            $runningBalance -= $transaction['credit'];

            $transaction['balance'] = round($runningBalance, 2);

            return $transaction;
        });

        return [
            'customer' => $customer,
            'transactions' => $transactions,
            'invoices_total' => round(
                $bookings->sum(fn ($booking) => (float) $booking->total_amount + (float) ($booking->plate_deposit ?? 0)),
                2
            ),
            'payments_total' => round(
                $payments->sum('amount'),
                2
            ),
            'deposit_returned_total' => round((float) $bookings->sum('plate_deposit_returned'), 2),
            'balance' => round($runningBalance, 2),
            'balance_type' => $this->getBalanceType($runningBalance),
        ];
    }

    /**
     * حساب جميع العملاء.
     */
    public function getAllAccounts(): Collection
    {
        return Customer::query()
            ->withCount('bookings')
            ->withSum('bookings', 'total_amount')
            ->withSum('bookings as bookings_sum_plate_deposit', 'plate_deposit')
            ->withSum('bookings as bookings_sum_plate_deposit_returned', 'plate_deposit_returned')
            ->withSum('payments', 'amount')
            ->get()
            ->map(function (Customer $customer) {

                $invoicesTotal = (float) ($customer->bookings_sum_total_amount ?? 0)
                    + (float) ($customer->bookings_sum_plate_deposit ?? 0);
                $depositReturned = (float) ($customer->bookings_sum_plate_deposit_returned ?? 0);
                $paymentsTotal = (float) ($customer->payments_sum_amount ?? 0);

                $balance = round(
                    $invoicesTotal - $paymentsTotal,
                    2
                );

                return [
                    'customer' => $customer,
                    'invoices_total' => $invoicesTotal,
                    'invoices_count' => (int) $customer->bookings_count,
                    'deposit_returned_total' => round($depositReturned, 2),
                    'net_invoices_total' => round($invoicesTotal - $depositReturned, 2),
                    'net_collected_total' => round($paymentsTotal - $depositReturned, 2),
                    'payments_total' => $paymentsTotal,
                    'balance' => $balance,
                    'balance_type' => $this->getBalanceType($balance),
                ];
            });
    }

    private function getBalanceType(float $balance): string
    {
        if ($balance > 0) {
            return 'due';
        }

        if ($balance < 0) {
            return 'credit';
        }

        return 'settled';
    }
}