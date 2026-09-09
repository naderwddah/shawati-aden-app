<?php

namespace App\Http\Controllers;

use App\Http\Requests\Customer\StoreCustomerRequest;
use App\Http\Requests\Customer\UpdateCustomerRequest;
use App\Http\Resources\CustomerDetailsResource;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Services\CustomerAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function __construct(
        private CustomerAccountService $accountService
    ) {
    }

    /**
     * قائمة العملاء.
     */
    public function index(Request $request): JsonResponse
    {
        $customers = Customer::query()
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
            'data' => CustomerResource::collection($customers),
        ]);
    }

    /**
     * إنشاء عميل.
     */
    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $customer = Customer::create($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء العميل بنجاح.',
            'data' => new CustomerResource($customer),
        ], 201);
    }

    /**
     * عرض عميل مع حسابه وكشف حسابه.
     */
    public function show(Customer $customer): JsonResponse
    {
        $customer->load([
            'bookings',
            'payments.paymentMethod',
        ]);

        $account = $this->accountService->getAccount($customer);
        $statement = $this->accountService->getStatement($customer);

        return response()->json([
            'success' => true,
            'data' => new CustomerDetailsResource($customer),
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
     * تحديث العميل.
     */
    public function update(
        UpdateCustomerRequest $request,
        Customer $customer
    ): JsonResponse {
        $customer->update($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث العميل بنجاح.',
            'data' => new CustomerResource($customer->fresh()),
        ]);
    }

    /**
     * حذف العميل.
     */
    public function destroy(Customer $customer): JsonResponse
    {
        if (
            $customer->bookings()->exists() ||
            $customer->payments()->exists()
        ) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن حذف العميل لوجود حجوزات أو دفعات مرتبطة به.',
            ], 422);
        }

        $customer->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف العميل بنجاح.',
        ]);
    }

    /**
     * حساب العميل فقط.
     */
    public function account(Customer $customer): JsonResponse
    {
        $account = $this->accountService->getAccount($customer);

        return response()->json([
            'success' => true,
            'data' => [
                'customer' => new CustomerResource($customer),
                'invoices_total' => $account['invoices_total'],
                'payments_total' => $account['payments_total'],
                'balance' => $account['balance'],
                'balance_type' => $account['balance_type'],
            ],
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
            'data' => [
                'customer' => new CustomerResource($customer),
                'transactions' => $statement['transactions'],
                'invoices_total' => $statement['invoices_total'],
                'payments_total' => $statement['payments_total'],
                'balance' => $statement['balance'],
                'balance_type' => $statement['balance_type'],
            ],
        ]);
    }
}