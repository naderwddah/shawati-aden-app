<?php

namespace App\Http\Controllers;

use App\Http\Requests\Booking\StoreBookingRequest;
use App\Http\Requests\Booking\UpdateBookingRequest;
use App\Http\Resources\BookingDetailsResource;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Services\BookingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    public function __construct(
        private BookingService $bookingService
    ) {
    }

    /**
     * قائمة الحجوزات.
     */
    public function index(Request $request): JsonResponse
    {
        $bookings = Booking::query()
            ->with('customer')

            ->when(
                $request->filled('search'),
                function ($query) use ($request) {
                    $search = $request->input('search');

                    $query->where(function ($q) use ($search) {
                        $q->where('mark', 'like', "%{$search}%")
                            ->orWhereHas('customer', function ($customer) use ($search) {
                                $customer
                                    ->where('name', 'like', "%{$search}%")
                                    ->orWhere('phone', 'like', "%{$search}%");
                            });
                    });
                }
            )

            ->when(
                $request->filled('customer_id'),
                fn ($query) =>
                    $query->where(
                        'customer_id',
                        $request->input('customer_id')
                    )
            )

            ->when(
                $request->filled('status'),
                fn ($query) =>
                    $query->where(
                        'status',
                        $request->input('status')
                    )
            )

            ->when(
                $request->filled('event_date'),
                fn ($query) =>
                    $query->whereDate(
                        'event_date',
                        $request->input('event_date')
                    )
            )

            ->when(
                $request->filled('from_date'),
                fn ($query) =>
                    $query->whereDate(
                        'event_date',
                        '>=',
                        $request->input('from_date')
                    )
            )

            ->when(
                $request->filled('to_date'),
                fn ($query) =>
                    $query->whereDate(
                        'event_date',
                        '<=',
                        $request->input('to_date')
                    )
            )

            ->orderBy('event_date')
            ->orderBy('delivery_time')
            ->get();

        return response()->json([
            'success' => true,
            'data' => BookingResource::collection($bookings),
        ]);
    }

    /**
     * إنشاء حجز.
     */
    public function store(StoreBookingRequest $request): JsonResponse
    {
        $booking = $this->bookingService->create(
            $request->validated()
        );

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الحجز بنجاح.',
            'data' => new BookingDetailsResource($booking),
        ], 201);
    }

    /**
     * عرض تفاصيل الحجز.
     */
    public function show(Booking $booking): JsonResponse
    {
        $booking->load([
            'customer',
            'items',
            'payments.paymentMethod',
        ]);

        return response()->json([
            'success' => true,
            'data' => new BookingDetailsResource($booking),
        ]);
    }

    /**
     * تحديث الحجز.
     */
    public function update(
        UpdateBookingRequest $request,
        Booking $booking
    ): JsonResponse {
        $data = $request->validated();

        /*
         * تحديث بيانات الحجز.
         */
        $bookingData = collect($data)
            ->except('items')
            ->toArray();

        if (!empty($bookingData)) {
            $booking->update($bookingData);
        }

        /*
         * تحديث عناصر الحجز إذا تم إرسالها.
         */
        if (array_key_exists('items', $data)) {
            $booking->items()->delete();

            $totalAmount = 0;

            foreach ($data['items'] as $item) {
                $quantity = (float) $item['quantity'];
                $unitPrice = (float) $item['unit_price'];

                $totalPrice = round(
                    $quantity * $unitPrice,
                    2
                );

                $totalAmount += $totalPrice;

                $booking->items()->create([
                    'item_name' => $item['item_name'],
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'total_price' => $totalPrice,
                ]);
            }

            /*
             * الإجمالي الحقيقي يحسب من العناصر.
             */
            $booking->update([
                'total_amount' => round($totalAmount, 2),
            ]);
        }

        $booking->load([
            'customer',
            'items',
            'payments.paymentMethod',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث الحجز بنجاح.',
            'data' => new BookingDetailsResource($booking),
        ]);
    }

    /**
     * حذف الحجز.
     */
    public function destroy(Booking $booking): JsonResponse
    {
        /*
         * حذف الحجز يحذف عناصره تلقائيًا.
         *
         * أما دفعات العميل فـ booking_id يصبح NULL
         * حسب علاقة قاعدة البيانات.
         */
        $booking->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الحجز بنجاح.',
        ]);
    }

    /**
     * حجوزات يوم محدد.
     */
    public function byDate(string $date): JsonResponse
    {
        $bookings = Booking::query()
            ->whereDate('event_date', $date)
            ->with('customer')
            ->orderBy('delivery_time')
            ->get();

        return response()->json([
            'success' => true,
            'date' => $date,
            'data' => BookingResource::collection($bookings),
        ]);
    }

    /**
     * الحجوزات القادمة.
     */
    public function upcoming(Request $request): JsonResponse
    {
        $days = max(
            1,
            min(
                (int) $request->input('days', 7),
                90
            )
        );

        $bookings = Booking::query()
            ->whereBetween('event_date', [
                now()->toDateString(),
                now()->addDays($days)->toDateString(),
            ])
            ->with('customer')
            ->orderBy('event_date')
            ->orderBy('delivery_time')
            ->get();

        return response()->json([
            'success' => true,
            'days' => $days,
            'data' => BookingResource::collection($bookings),
        ]);
    }
}