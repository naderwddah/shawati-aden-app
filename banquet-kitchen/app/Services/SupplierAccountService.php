<?php

namespace App\Services;

use App\Models\Supplier;
use Illuminate\Support\Collection;

class SupplierAccountService
{
    /**
     * حساب المورد:
     * إجمالي فواتير المورد - إجمالي الدفعات
     */
    public function getAccount(Supplier $supplier): array
    {
        $invoicesTotal = (float) $supplier->invoices()
            ->sum('total_amount');

        $paymentsTotal = (float) $supplier->payments()
            ->sum('amount');

        $balance = round($invoicesTotal - $paymentsTotal, 2);

        return [
            'supplier' => $supplier,
            'invoices_total' => $invoicesTotal,
            'payments_total' => $paymentsTotal,
            'balance' => $balance,
            'balance_type' => $this->getBalanceType($balance),
        ];
    }

    /**
     * كشف حساب المورد بالتفصيل.
     */
    public function getStatement(Supplier $supplier): array
    {
        $invoices = $supplier->invoices()
            ->orderBy('invoice_date')
            ->get();

        $payments = $supplier->payments()
            ->with('paymentMethod')
            ->orderBy('payment_date')
            ->get();

        $transactions = collect();

        foreach ($invoices as $invoice) {
            $transactions->push([
                'type' => 'invoice',
                'id' => $invoice->id,
                'date' => $invoice->invoice_date,
                'description' => 'فاتورة مورد #' . $invoice->id,
                'debit' => (float) $invoice->total_amount,
                'credit' => 0,
                'invoice_number' => $invoice->invoice_number,
            ]);
        }

        foreach ($payments as $payment) {
            $transactions->push([
                'type' => 'payment',
                'id' => $payment->id,
                'date' => $payment->payment_date,
                'description' => 'دفعة للمورد',
                'debit' => 0,
                'credit' => (float) $payment->amount,
                'payment_method' => $payment->paymentMethod?->name,
            ]);
        }

        $transactions = $transactions
            ->sortBy('date')
            ->values();

        $runningBalance = 0;

        $transactions = $transactions->map(
            function (array $transaction) use (&$runningBalance) {
                $runningBalance += $transaction['debit'];
                $runningBalance -= $transaction['credit'];

                $transaction['balance'] = round(
                    $runningBalance,
                    2
                );

                return $transaction;
            }
        );

        return [
            'supplier' => $supplier,
            'transactions' => $transactions,
            'invoices_total' => round(
                $invoices->sum('total_amount'),
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
     * حساب جميع الموردين.
     */
    public function getAllAccounts(): Collection
    {
        return Supplier::query()
            ->withSum('invoices', 'total_amount')
            ->withSum('payments', 'amount')
            ->get()
            ->map(function (Supplier $supplier) {

                $invoicesTotal = (float) (
                    $supplier->invoices_sum_total_amount ?? 0
                );

                $paymentsTotal = (float) (
                    $supplier->payments_sum_amount ?? 0
                );

                $balance = round(
                    $invoicesTotal - $paymentsTotal,
                    2
                );

                return [
                    'supplier' => $supplier,
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