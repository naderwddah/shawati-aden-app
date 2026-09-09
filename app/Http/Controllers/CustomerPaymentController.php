<?php

namespace App\Http\Controllers;

use App\Http\Requests\Payment\StoreCustomerPaymentRequest;
use App\Http\Resources\CustomerPaymentResource;
use App\Models\CustomerPayment;
use App\Services\CustomerPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerPaymentController extends Controller
{
    public function __construct(
        private CustomerPaymentService $paymentService
    ) {
    }

    /**
     * قائمة دفعات العملاء.
     */
    public function index(Request $request): JsonResponse
    {
        $payments = CustomerPayment::query()
            ->with([
                'customer',
                'booking',
                'paymentMethod',
            ])
            ->when(
                $request->filled('customer_id'),
                fn ($query) =>
                    $query->where(
                        'customer_id',
                        $request->input('customer_id')
                    )
            )
            ->when(
                $request->filled('booking_id'),
                fn ($query) =>
                    $query->where(
                        'booking_id',
                        $request->input('booking_id')
                    )
            )
            ->when(
                $request->filled('payment_method_id'),
                fn ($query) =>
                    $query->where(
                        'payment_method_id',
                        $request->input('payment_method_id')
                    )
            )
            ->when(
                $request->filled('from_date'),
                fn ($query) =>
                    $query->whereDate(
                        'payment_date',
                        '>=',
                        $request->input('from_date')
                    )
            )
            ->when(
                $request->filled('to_date'),
                fn ($query) =>
                    $query->whereDate(
                        'payment_date',
                        '<=',
                        $request->input('to_date')
                    )
            )
            ->orderByDesc('payment_date')
            ->get();

        return response()->json([
            'success' => true,
            'data' => CustomerPaymentResource::collection($payments),
        ]);
    }

    /**
     * تسجيل دفعة.
     */
    public function store(
        StoreCustomerPaymentRequest $request
    ): JsonResponse {
        $payment = $this->paymentService->create(
            $request->validated()
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل الدفعة بنجاح.',
            'data' => new CustomerPaymentResource($payment),
        ], 201);
    }

    /**
     * عرض دفعة.
     */
    public function show(
        CustomerPayment $customerPayment
    ): JsonResponse {
        $customerPayment->load([
            'customer',
            'booking',
            'paymentMethod',
        ]);

        return response()->json([
            'success' => true,
            'data' => new CustomerPaymentResource($customerPayment),
        ]);
    }

    /**
     * حذف دفعة.
     */
    public function destroy(
        CustomerPayment $customerPayment
    ): JsonResponse {
        $customerPayment->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الدفعة بنجاح.',
        ]);
    }
}