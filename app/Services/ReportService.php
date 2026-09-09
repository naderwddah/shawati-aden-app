<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\CustomerPayment;
use App\Models\Supplier;
use App\Models\SupplierInvoice;
use App\Models\SupplierPayment;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ReportService
{
    /**
     * ملخص اليوم.
     */
    public function dailySummary(?string $date = null): array
    {
        $date = $date
            ? Carbon::parse($date)->toDateString()
            : now()->toDateString();

        $bookings = Booking::query()
            ->whereDate('event_date', $date)
            ->with('customer')
            ->orderBy('delivery_time')
            ->get();

        $customerPayments = CustomerPayment::query()
            ->whereDate('payment_date', $date)
            ->sum('amount');

        $supplierPayments = SupplierPayment::query()
            ->whereDate('payment_date', $date)
            ->sum('amount');

        $supplierInvoices = SupplierInvoice::query()
            ->whereDate('invoice_date', $date)
            ->sum('total_amount');

        return [
            'date' => $date,

            'bookings_count' => $bookings->count(),

            'bookings_total' => round(
                $bookings->sum('total_amount'),
                2
            ),

            'customer_payments' => round(
                (float) $customerPayments,
                2
            ),

            'supplier_invoices' => round(
                (float) $supplierInvoices,
                2
            ),

            'supplier_payments' => round(
                (float) $supplierPayments,
                2
            ),

            'bookings' => $bookings,
        ];
    }

    /**
     * حجوزات تاريخ محدد.
     */
    public function bookingsByDate(string $date): Collection
    {
        return Booking::query()
            ->whereDate('event_date', $date)
            ->with([
                'customer',
                'items',
                'payments.paymentMethod',
            ])
            ->orderBy('delivery_time')
            ->get();
    }

    /**
     * حجوزات قادمة.
     */
    public function upcomingBookings(int $days = 7): Collection
    {
        $today = now()->toDateString();
        $until = now()->addDays($days)->toDateString();

        return Booking::query()
            ->whereBetween('event_date', [$today, $until])
            ->with('customer')
            ->orderBy('event_date')
            ->orderBy('delivery_time')
            ->get();
    }

    /**
     * إجمالي حسابات العملاء.
     */
    public function customerAccountsSummary(): array
    {
        $invoicesTotal = (float) Customer::query()
            ->withSum('bookings', 'total_amount')
            ->get()
            ->sum('bookings_sum_total_amount');

        $paymentsTotal = (float) CustomerPayment::sum('amount');

        $balance = round(
            $invoicesTotal - $paymentsTotal,
            2
        );

        return [
            'invoices_total' => round($invoicesTotal, 2),
            'payments_total' => round($paymentsTotal, 2),
            'balance' => $balance,
        ];
    }

    /**
     * إجمالي حسابات الموردين.
     */
    public function supplierAccountsSummary(): array
    {
        $invoicesTotal = (float) SupplierInvoice::sum('total_amount');

        $paymentsTotal = (float) SupplierPayment::sum('amount');

        $balance = round(
            $invoicesTotal - $paymentsTotal,
            2
        );

        return [
            'invoices_total' => round($invoicesTotal, 2),
            'payments_total' => round($paymentsTotal, 2),
            'balance' => $balance,
        ];
    }

    /**
     * التقرير المالي الإجمالي.
     */
    public function financialSummary(): array
    {
        $sales = (float) Booking::sum('total_amount');
        $customerPayments = (float) CustomerPayment::sum('amount');

        $purchases = (float) SupplierInvoice::sum('total_amount');
        $supplierPayments = (float) SupplierPayment::sum('amount');

        return [
            'sales_total' => round($sales, 2),
            'customer_payments_total' => round($customerPayments, 2),
            'customer_balance' => round(
                $sales - $customerPayments,
                2
            ),

            'purchases_total' => round($purchases, 2),
            'supplier_payments_total' => round($supplierPayments, 2),
            'supplier_balance' => round(
                $purchases - $supplierPayments,
                2
            ),

            'net_sales_minus_purchases' => round(
                $sales - $purchases,
                2
            ),
        ];
    }
}