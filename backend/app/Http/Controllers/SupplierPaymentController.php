<?php

namespace App\Http\Controllers;

use App\Http\Requests\Payment\StoreSupplierPaymentRequest;
use App\Http\Resources\SupplierPaymentResource;
use App\Models\SupplierPayment;
use App\Services\SupplierPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierPaymentController extends Controller
{
    public function __construct(
        private SupplierPaymentService $paymentService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $payments = SupplierPayment::query()
            ->with([
                'supplier',
                'paymentMethod',
            ])
            ->when(
                $request->filled('supplier_id'),
                fn ($query) =>
                    $query->where(
                        'supplier_id',
                        $request->input('supplier_id')
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
            'data' => SupplierPaymentResource::collection($payments),
        ]);
    }

    public function store(
        StoreSupplierPaymentRequest $request
    ): JsonResponse {
        $payment = $this->paymentService->create(
            $request->validated()
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل دفعة المورد بنجاح.',
            'data' => new SupplierPaymentResource($payment),
        ], 201);
    }

    public function show(
        SupplierPayment $supplierPayment
    ): JsonResponse {
        $supplierPayment->load([
            'supplier',
            'paymentMethod',
        ]);

        return response()->json([
            'success' => true,
            'data' => new SupplierPaymentResource($supplierPayment),
        ]);
    }

    public function destroy(
        SupplierPayment $supplierPayment
    ): JsonResponse {
        $supplierPayment->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف دفعة المورد بنجاح.',
        ]);
    }
}