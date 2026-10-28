<?php

namespace App\Services;

use App\Models\Customer;
use Illuminate\Support\Collection;

class CustomerAccountService
{
    /**
     * حساب العميل:
     * إجمالي الفواتير - إجمالي الدفعات
     */
    public function getAccount(Customer $customer): array
    {
        $invoicesTotal = (float) $customer->bookings()->sum('total_amount');

        $paymentsTotal = (float) $customer->payments()->sum('amount');

        $balance = round($invoicesTotal - $paymentsTotal, 2);

        return [
            'customer' => $customer,
            'invoices_total' => $invoicesTotal,
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
                'debit' => (float) $booking->total_amount,
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
                $bookings->sum('total_amount'),
                2
            ),
            'payments_total' => round(
                $payments->sum('amount'),
                2
            ),
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
            ->withSum('bookings', 'total_amount')
            ->withSum('payments', 'amount')
            ->get()
            ->map(function (Customer $customer) {

                $invoicesTotal = (float) ($customer->bookings_sum_total_amount ?? 0);
                $paymentsTotal = (float) ($customer->payments_sum_amount ?? 0);

                $balance = round(
                    $invoicesTotal - $paymentsTotal,
                    2
                );

                return [
                    'customer' => $customer,
                    'invoices_total' => $invoicesTotal,
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