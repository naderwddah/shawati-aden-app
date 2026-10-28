<?php

namespace App\Http\Controllers;

use App\Models\PaymentMethod;
use App\Http\Resources\PaymentMethodResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentMethodController extends Controller
{
    /**
     * عرض طرق الدفع.
     */
    public function index(Request $request): JsonResponse
    {
        $methods = PaymentMethod::query()
            ->when(
                $request->has('is_active'),
                fn ($query) =>
                    $query->where(
                        'is_active',
                        filter_var(
                            $request->input('is_active'),
                            FILTER_VALIDATE_BOOLEAN
                        )
                    )
            )
            ->orderBy('id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => PaymentMethodResource::collection($methods),
        ]);
    }

    /**
     * إنشاء طريقة دفع.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:50',
                'unique:payment_methods,name',
            ],
            'is_active' => [
                'sometimes',
                'boolean',
            ],
        ]);

        $method = PaymentMethod::create([
            'name' => $validated['name'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء طريقة الدفع بنجاح.',
            'data' => new PaymentMethodResource($method),
        ], 201);
    }

    /**
     * عرض طريقة دفع.
     */
    public function show(PaymentMethod $paymentMethod): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => new PaymentMethodResource($paymentMethod),
        ]);
    }

    /**
     * تحديث طريقة دفع.
     */
    public function update(
        Request $request,
        PaymentMethod $paymentMethod
    ): JsonResponse {
        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:50',
                Rule::unique('payment_methods', 'name')
                    ->ignore($paymentMethod->id),
            ],
            'is_active' => [
                'sometimes',
                'boolean',
            ],
        ]);

        $paymentMethod->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث طريقة الدفع بنجاح.',
            'data' => new PaymentMethodResource($paymentMethod->fresh()),
        ]);
    }

    /**
     * حذف طريقة دفع.
     */
    public function destroy(PaymentMethod $paymentMethod): JsonResponse
    {
        $usedByCustomers = $paymentMethod
            ->customerPayments()
            ->exists();

        $usedBySuppliers = $paymentMethod
            ->supplierPayments()
            ->exists();

        if ($usedByCustomers || $usedBySuppliers) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن حذف طريقة الدفع لأنها مستخدمة في عمليات مالية.',
            ], 422);
        }

        $paymentMethod->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف طريقة الدفع بنجاح.',
        ]);
    }
}