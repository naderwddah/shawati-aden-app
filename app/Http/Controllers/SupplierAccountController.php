<?php

namespace App\Http\Controllers;

use App\Models\Supplier;
use App\Services\SupplierAccountService;
use Illuminate\Http\JsonResponse;

class SupplierAccountController extends Controller
{
    public function __construct(
        private SupplierAccountService $accountService
    ) {
    }

    /**
     * عرض حساب مورد.
     */
    public function show(Supplier $supplier): JsonResponse
    {
        $account = $this->accountService->getAccount($supplier);

        return response()->json([
            'success' => true,
            'data' => $account,
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
            'data' => $statement,
        ]);
    }

    /**
     * ملخص حسابات جميع الموردين.
     */
    public function index(): JsonResponse
    {
        $accounts = $this->accountService->getAllAccounts();

        return response()->json([
            'success' => true,
            'data' => $accounts,
        ]);
    }
}