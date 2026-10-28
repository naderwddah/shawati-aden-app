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
use Illuminate\Support\Facades\DB;

class BookingController extends Controller
{
    public function __construct(
        private BookingService $bookingService
    ) {
    }

    /**
     * قائمة الحجوزات.
     *
     * يتم جلب مجموع الدفعات لكل حجز مباشرة من قاعدة البيانات
     * حتى تتمكن BookingResource من حساب المدفوع والمتبقي بشكل صحيح.
     */
    public function index(Request $request): JsonResponse
    {
        $bookings = Booking::query()
            ->with('customer')
            ->when($request->boolean('include_items'), fn ($query) => $query->with('items'))
            ->withSum('payments', 'amount')
            ->withSum('items', 'quantity')

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
     * Updating booking details and replacing its items is atomic.
     * Status-only updates do not touch the invoice or its item snapshots.
     */
    public function update(UpdateBookingRequest $request, Booking $booking): JsonResponse
    {
        $data = $request->validated();
        $booking = DB::transaction(function () use ($data, $booking) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            $bookingData = collect($data)->except(['items', 'total_amount'])->toArray();

            $itemsTotal = (float) $booking->total_amount;
            if (array_key_exists('items', $data)) {
                $itemsTotal = round(array_sum(array_map(
                    fn ($item) => round((float) $item['quantity'] * (float) $item['unit_price'], 2),
                    $data['items']
                )), 2);
                $bookingData['total_amount'] = $itemsTotal;
            }

            $deposit = (float) ($bookingData['plate_deposit'] ?? $booking->plate_deposit ?? 0);
            $returned = (float) ($bookingData['plate_deposit_returned'] ?? $booking->plate_deposit_returned ?? 0);
            $paid = (float) $booking->payments()->sum('amount');
            if ($returned > $deposit || $returned > $paid ||
                (array_key_exists('plate_deposit_returned', $bookingData) &&
                    $returned < (float) ($booking->plate_deposit_returned ?? 0))) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'plate_deposit_returned' => 'المسترد يجب ألا يقل عن المسترد سابقًا أو يتجاوز التأمين أو المبالغ المحصلة.',
                ]);
            }
            if ((int) round(($itemsTotal + $deposit) * 100) < (int) round($paid * 100)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'items' => 'لا يمكن أن يصبح إجمالي الحجز شاملًا التأمين أقل من الدفعات المسجلة.',
                ]);
            }

            if ($bookingData) {
                $booking->update($bookingData);
            }
            if (array_key_exists('items', $data)) {
                $booking->items()->delete();
                foreach ($data['items'] as $item) {
                    $quantity = (float) $item['quantity'];
                    $unitPrice = (float) $item['unit_price'];
                    $booking->items()->create([
                        'item_name' => $item['item_name'],
                        'quantity' => $quantity,
                        'unit_price' => $unitPrice,
                        'total_price' => round($quantity * $unitPrice, 2),
                    ]);
                }
            }
            return $booking->load(['customer', 'items', 'payments.paymentMethod']);
        });

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث الحجز بنجاح.',
            'data' => new BookingDetailsResource($booking),
        ]);
    }

    /**
     * Completes a booking and takes an optional payment as one DB transaction.
     */
    public function complete(Request $request, Booking $booking): JsonResponse
    {
        $data = $request->validate([
            'payment_amount' => ['sometimes', 'numeric', 'min:0'],
            'payment_method_id' => ['nullable', 'integer', 'exists:payment_methods,id'],
        ]);
        $amount = (float) ($data['payment_amount'] ?? 0);
        if ($amount > 0 && empty($data['payment_method_id'])) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'payment_method_id' => 'اختر طريقة دفع للمبلغ المستلم.',
            ]);
        }
        $booking = $this->bookingService->complete(
            $booking,
            $amount,
            isset($data['payment_method_id']) ? (int) $data['payment_method_id'] : null
        );
        return response()->json([
            'success' => true,
            'message' => 'اكتمل الحجز وتم تسجيل الدفعة إن وجدت.',
            'data' => new BookingDetailsResource($booking),
        ]);
    }

    /**
     * حذف الحجز.
     *
     * عند حذف الحجز يتم حذف جميع الدفعات المرتبطة
     * بهذا الحجز فقط، ثم حذف الحجز نفسه.
     *
     * تتم العمليتان داخل Transaction واحدة لضمان
     * عدم حدوث حذف جزئي في حال وقوع خطأ.
     */
    public function destroy(Booking $booking): JsonResponse
    {
        DB::transaction(function () use ($booking) {
            /*
             * حذف دفعات هذا الحجز فقط.
             *
             * لا يتم حذف أي دفعات أخرى تخص العميل
             * إذا كانت مرتبطة بحجوزات أخرى أو غير مرتبطة
             * بأي حجز.
             */
            $booking->payments()->delete();

            /*
             * حذف الحجز.
             *
             * عناصر الحجز تستمر في الاعتماد على
             * إعدادات قاعدة البيانات الحالية لحذفها.
             */
            $booking->delete();
        });

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الحجز وجميع الدفعات المرتبطة به بنجاح.',
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
            ->withSum('payments', 'amount')
            ->withSum('items', 'quantity')
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
            ->withSum('payments', 'amount')
            ->withSum('items', 'quantity')
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