<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\CustomerPayment;
use App\Models\SupplierInvoice;
use App\Models\SupplierPayment;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ReportService
{
    /**
     * ملخص اليوم.
     *
     * يعتمد على:
     * - event_date للحجوزات
     * - payment_date لدفعات العملاء والموردين
     * - invoice_date لفواتير الموردين
     */
    public function dailySummary(?string $date = null): array
    {
        $date = $date
            ? Carbon::parse($date)->toDateString()
            : now()->toDateString();

        $bookings = Booking::query()
            ->whereDate('event_date', $date)
            ->with('customer')
            ->withSum('payments', 'amount')
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

        $bookingsTotal = (float) $bookings->sum('total_amount');

        $bookingsPaid = (float) $bookings->sum(
            fn ($booking) => (float) ($booking->payments_sum_amount ?? 0)
        );

        $bookingsRemaining = max(
            0,
            $bookingsTotal - $bookingsPaid
        );

        return [
            'date' => $date,

            'bookings_count' => $bookings->count(),

            'bookings_total' => round(
                $bookingsTotal,
                2
            ),

            'bookings_paid' => round(
                $bookingsPaid,
                2
            ),

            'bookings_remaining' => round(
                $bookingsRemaining,
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
     *
     * لا يتم تحميل الأصناف لأن التقارير الجديدة
     * لا تعرض الأصناف أو الكميات.
     */
    public function bookingsByDate(string $date): Collection
    {
        $date = Carbon::parse($date)->toDateString();

        return Booking::query()
            ->whereDate('event_date', $date)
            ->with([
                'customer',
                'payments.paymentMethod',
            ])
            ->withSum('payments', 'amount')
            ->orderBy('delivery_time')
            ->get();
    }

    /**
     * حجوزات قادمة.
     */
    public function upcomingBookings(int $days = 7): Collection
    {
        $today = now()->toDateString();

        $until = now()
            ->addDays($days)
            ->toDateString();

        return Booking::query()
            ->whereBetween('event_date', [
                $today,
                $until,
            ])
            ->with('customer')
            ->withSum('payments', 'amount')
            ->orderBy('event_date')
            ->orderBy('delivery_time')
            ->get();
    }

    /**
     * إجمالي حسابات العملاء.
     *
     * هذا ملخص عام لجميع الحسابات وليس تقرير فترة.
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
            'invoices_total' => round(
                $invoicesTotal,
                2
            ),

            'payments_total' => round(
                $paymentsTotal,
                2
            ),

            'balance' => $balance,
        ];
    }

    /**
     * إجمالي حسابات الموردين.
     *
     * هذا ملخص عام لجميع الحسابات وليس تقرير فترة.
     */
    public function supplierAccountsSummary(): array
    {
        $invoicesTotal = (float) SupplierInvoice::sum(
            'total_amount'
        );

        $paymentsTotal = (float) SupplierPayment::sum(
            'amount'
        );

        $balance = round(
            $invoicesTotal - $paymentsTotal,
            2
        );

        return [
            'invoices_total' => round(
                $invoicesTotal,
                2
            ),

            'payments_total' => round(
                $paymentsTotal,
                2
            ),

            'balance' => $balance,
        ];
    }

    /**
     * الملخص المالي حسب فترة زمنية.
     *
     * الحجوزات:
     *     event_date
     *
     * دفعات العملاء:
     *     payment_date
     *
     * فواتير الموردين:
     *     invoice_date
     *
     * دفعات الموردين:
     *     payment_date
     */
    public function financialSummary(
        ?string $fromDate = null,
        ?string $toDate = null
    ): array {
        /*
         * إذا لم يتم تحديد تاريخ بداية أو نهاية،
         * يتم استخدام كامل البيانات.
         */
        $from = $fromDate
            ? Carbon::parse($fromDate)->startOfDay()
            : null;

        $to = $toDate
            ? Carbon::parse($toDate)->endOfDay()
            : null;

        /*
         * إذا أرسل المستخدم تاريخ البداية فقط،
         * نعتبره يومًا واحدًا.
         */
        if ($from && !$to) {
            $to = $from->copy()->endOfDay();
        }

        /*
         * إذا أرسل المستخدم تاريخ النهاية فقط،
         * نعتبره يومًا واحدًا.
         */
        if (!$from && $to) {
            $from = $to->copy()->startOfDay();
        }

        /*
         * الحجوزات حسب event_date.
         */
        $bookingsQuery = Booking::query();

        if ($from && $to) {
            $bookingsQuery->whereBetween(
                'event_date',
                [$from, $to]
            );
        }

        $sales = (float) $bookingsQuery->sum(
            'total_amount'
        );

        /*
         * دفعات العملاء حسب payment_date.
         */
        $customerPaymentsQuery = CustomerPayment::query();

        if ($from && $to) {
            $customerPaymentsQuery->whereBetween(
                'payment_date',
                [$from, $to]
            );
        }

        $customerPayments = (float) $customerPaymentsQuery->sum(
            'amount'
        );

        /*
         * فواتير الموردين حسب invoice_date.
         */
        $supplierInvoicesQuery = SupplierInvoice::query();

        if ($from && $to) {
            $supplierInvoicesQuery->whereBetween(
                'invoice_date',
                [$from, $to]
            );
        }

        $purchases = (float) $supplierInvoicesQuery->sum(
            'total_amount'
        );

        /*
         * دفعات الموردين حسب payment_date.
         */
        $supplierPaymentsQuery = SupplierPayment::query();

        if ($from && $to) {
            $supplierPaymentsQuery->whereBetween(
                'payment_date',
                [$from, $to]
            );
        }

        $supplierPayments = (float) $supplierPaymentsQuery->sum(
            'amount'
        );

        /*
         * الأرصدة.
         */
        $customerBalance = $sales - $customerPayments;

        $supplierBalance = $purchases - $supplierPayments;

        $netSalesMinusPurchases = $sales - $purchases;

        return [
            'from_date' => $from?->toDateString(),
            'to_date' => $to?->toDateString(),

            'sales_total' => round(
                $sales,
                2
            ),

            'customer_payments_total' => round(
                $customerPayments,
                2
            ),

            'customer_balance' => round(
                $customerBalance,
                2
            ),

            'purchases_total' => round(
                $purchases,
                2
            ),

            'supplier_payments_total' => round(
                $supplierPayments,
                2
            ),

            'supplier_balance' => round(
                $supplierBalance,
                2
            ),

            'net_sales_minus_purchases' => round(
                $netSalesMinusPurchases,
                2
            ),
        ];
    }
}