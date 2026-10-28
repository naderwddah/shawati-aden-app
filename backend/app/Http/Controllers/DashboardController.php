<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Customer;
use App\Models\CustomerPayment;
use App\Models\Item;
use App\Models\Supplier;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Lightweight, independent dashboard sections.
 * The browser never needs the complete bookings/customers/items lists.
 */
class DashboardController extends Controller
{
    private function requestedDate(Request $request): CarbonImmutable
    {
        $date = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
        ])['date'];

        return CarbonImmutable::createFromFormat('!Y-m-d', $date);
    }

    private function activeBookings()
    {
        return Booking::query()->whereNotIn('status', ['cancelled', 'canceled', 'ملغي']);
    }

    public function today(Request $request): JsonResponse
    {
        $date = $this->requestedDate($request)->toDateString();

        $bookings = $this->activeBookings()
            ->whereDate('event_date', $date)
            ->select(['id', 'customer_id', 'event_date', 'delivery_time', 'delivery_period', 'total_amount', 'plate_deposit', 'status'])
            ->with('customer:id,name')
            ->orderBy('delivery_time')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'date' => $date,
                'count' => $bookings->count(),
                'total_amount' => round((float) $bookings->sum(fn ($b) => (float) $b->total_amount + (float) ($b->plate_deposit ?? 0)), 2),
                'bookings' => $bookings->map(fn (Booking $booking) => [
                    'id' => $booking->id,
                    'customer_name' => $booking->customer?->name ?? 'عميل',
                    'delivery_time' => $booking->delivery_time,
                    'delivery_period' => $booking->delivery_period,
                    'total_amount' => round((float) $booking->total_amount + (float) ($booking->plate_deposit ?? 0), 2),
                    'status' => $booking->status,
                ])->values(),
            ],
        ]);
    }

    public function upcoming(Request $request): JsonResponse
    {
        $date = $this->requestedDate($request);
        // Upcoming excludes today's bookings; those have their own section.
        $from = $date->addDay()->toDateString();
        $to = $date->addDays(7)->toDateString();

        $query = $this->activeBookings()
            ->whereBetween('event_date', [$from, $to]);

        $count = (clone $query)->count();

        $quantity = BookingItem::query()
            ->whereHas('booking', fn ($booking) => $booking
                ->whereBetween('event_date', [$from, $to])
                ->whereNotIn('status', ['cancelled', 'canceled', 'ملغي']))
            ->sum('quantity');

        $bookings = (clone $query)
            ->select(['id', 'customer_id', 'event_date', 'delivery_time', 'total_amount', 'plate_deposit'])
            ->with('customer:id,name')
            ->orderBy('event_date')
            ->orderBy('delivery_time')
            ->limit(10)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'from_date' => $from,
                'to_date' => $to,
                'count' => $count,
                'items_quantity' => round((float) $quantity, 2),
                'bookings' => $bookings->map(fn (Booking $booking) => [
                    'id' => $booking->id,
                    'customer_name' => $booking->customer?->name ?? 'عميل',
                    'event_date' => $booking->event_date,
                    'delivery_time' => $booking->delivery_time,
                    'total_amount' => round((float) $booking->total_amount + (float) ($booking->plate_deposit ?? 0), 2),
                ])->values(),
            ],
        ]);
    }

    public function receivables(): JsonResponse
    {
        // Same accounting rule as CustomerAccountService: invoices - payments.
        // Never count credits (negative balances) as receivables.
        $accounts = Customer::query()
            ->select(['id', 'name', 'phone'])
            ->withSum('bookings as invoices_total', 'total_amount')
            ->withSum('bookings as deposit_total', 'plate_deposit')
            ->withSum('payments as payments_total', 'amount')
            ->get()
            ->map(function (Customer $customer) {
                $balance = round(
                    (float) ($customer->invoices_total ?? 0) + (float) ($customer->deposit_total ?? 0) - (float) ($customer->payments_total ?? 0),
                    2
                );

                return [
                    'customer_id' => $customer->id,
                    'name' => $customer->name,
                    'phone' => $customer->phone,
                    'balance' => $balance,
                ];
            })
            ->filter(fn (array $account) => $account['balance'] > 0)
            ->sortByDesc('balance')
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'count' => $accounts->count(),
                'total_amount' => round((float) $accounts->sum('balance'), 2),
                'accounts' => $accounts->take(10)->values(),
            ],
        ]);
    }

    public function overview(Request $request): JsonResponse
    {
        $date = $this->requestedDate($request)->toDateString();

        return response()->json([
            'success' => true,
            'data' => [
                'date' => $date,
                'active_customers' => Customer::query()->where('is_active', true)->count(),
                'suppliers_count' => Supplier::query()->count(),
                'items_count' => Item::query()->count(),
                // Money collected on the calendar day, NOT invoice values.
                'customer_payments_today' => round((float) CustomerPayment::query()
                    ->whereDate('payment_date', $date)
                    ->sum('amount'), 2),
            ],
        ]);
    }
}
