<?php

namespace App\Http\Controllers;

use App\Http\Requests\Supplier\StoreSupplierRequest;
use App\Http\Requests\Supplier\UpdateSupplierRequest;
use App\Http\Resources\SupplierDetailsResource;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use App\Services\SupplierAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function __construct(
        private SupplierAccountService $accountService
    ) {
    }

    /**
     * قائمة الموردين.
     */
    public function index(Request $request): JsonResponse
    {
        $suppliers = Supplier::query()
            ->when(
                $request->filled('search'),
                function ($query) use ($request) {
                    $search = $request->input('search');

                    $query->where(function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%");
                    });
                }
            )
            ->when(
                $request->has('is_active'),
                fn ($query) =>
                    $query->where(
                        'is_active',
                        $request->boolean('is_active')
                    )
            )
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => SupplierResource::collection($suppliers),
        ]);
    }

    /**
     * إنشاء مورد.
     */
    public function store(StoreSupplierRequest $request): JsonResponse
    {
        $supplier = Supplier::create($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء المورد بنجاح.',
            'data' => new SupplierResource($supplier),
        ], 201);
    }

    /**
     * عرض المورد مع حسابه.
     */
    public function show(Supplier $supplier): JsonResponse
    {
        $supplier->load([
            'invoices',
            'payments.paymentMethod',
        ]);

        $account = $this->accountService->getAccount($supplier);
        $statement = $this->accountService->getStatement($supplier);

        return response()->json([
            'success' => true,
            'data' => new SupplierDetailsResource($supplier),
            'account' => [
                'invoices_total' => $account['invoices_total'],
                'payments_total' => $account['payments_total'],
                'balance' => $account['balance'],
                'balance_type' => $account['balance_type'],
            ],
            'statement' => $statement['transactions'],
        ]);
    }

    /**
     * تحديث المورد.
     */
    public function update(
        UpdateSupplierRequest $request,
        Supplier $supplier
    ): JsonResponse {
        $supplier->update($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث المورد بنجاح.',
            'data' => new SupplierResource($supplier->fresh()),
        ]);
    }

    /**
     * حذف المورد.
     */
    public function destroy(Supplier $supplier): JsonResponse
    {
        if (
            $supplier->invoices()->exists() ||
            $supplier->payments()->exists()
        ) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن حذف المورد لوجود فواتير أو دفعات مرتبطة به.',
            ], 422);
        }

        $supplier->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف المورد بنجاح.',
        ]);
    }

    /**
     * حساب المورد فقط.
     */
    public function account(Supplier $supplier): JsonResponse
    {
        $account = $this->accountService->getAccount($supplier);

        return response()->json([
            'success' => true,
            'data' => [
                'supplier' => new SupplierResource($supplier),
                'invoices_total' => $account['invoices_total'],
                'payments_total' => $account['payments_total'],
                'balance' => $account['balance'],
                'balance_type' => $account['balance_type'],
            ],
        ]);
    }

    /**
     * كشف حساب المورد.
     */
    public function statement(Supplier $supplier): JsonResponse
    {
        $statement = $this->accountService->getStatement($supplier);

        return response()->json([
            'success' => true,
            'data' => [
                'supplier' => new SupplierResource($supplier),
                'transactions' => $statement['transactions'],
                'invoices_total' => $statement['invoices_total'],
                'payments_total' => $statement['payments_total'],
                'balance' => $statement['balance'],
                'balance_type' => $statement['balance_type'],
            ],
        ]);
    }
}