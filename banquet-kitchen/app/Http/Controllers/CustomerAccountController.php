<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Services\CustomerAccountService;
use Illuminate\Http\JsonResponse;

class CustomerAccountController extends Controller
{
    public function __construct(
        private CustomerAccountService $accountService
    ) {
    }

    /**
     * عرض حساب عميل.
     */
    public function show(Customer $customer): JsonResponse
    {
        $account = $this->accountService->getAccount($customer);

        return response()->json([
            'success' => true,
            'data' => $account,
        ]);
    }

    /**
     * كشف حساب العميل.
     */
    public function statement(Customer $customer): JsonResponse
    {
        $statement = $this->accountService->getStatement($customer);

        return response()->json([
            'success' => true,
            'data' => $statement,
        ]);
    }

    /**
     * ملخص حسابات جميع العملاء.
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