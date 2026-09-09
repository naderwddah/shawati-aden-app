<?php

namespace App\Http\Controllers;

use App\Http\Requests\SupplierInvoice\StoreSupplierInvoiceRequest;
use App\Http\Resources\SupplierInvoiceResource;
use App\Models\SupplierInvoice;
use App\Services\SupplierInvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierInvoiceController extends Controller
{
    public function __construct(
        private SupplierInvoiceService $invoiceService
    ) {
    }

    /**
     * قائمة فواتير الموردين.
     */
    public function index(Request $request): JsonResponse
    {
        $invoices = SupplierInvoice::query()
            ->with('supplier')

            ->when(
                $request->filled('supplier_id'),
                fn ($query) =>
                    $query->where(
                        'supplier_id',
                        $request->input('supplier_id')
                    )
            )

            ->when(
                $request->filled('invoice_number'),
                fn ($query) =>
                    $query->where(
                        'invoice_number',
                        'like',
                        '%' . $request->input('invoice_number') . '%'
                    )
            )

            ->when(
                $request->filled('from_date'),
                fn ($query) =>
                    $query->whereDate(
                        'invoice_date',
                        '>=',
                        $request->input('from_date')
                    )
            )

            ->when(
                $request->filled('to_date'),
                fn ($query) =>
                    $query->whereDate(
                        'invoice_date',
                        '<=',
                        $request->input('to_date')
                    )
            )

            ->orderByDesc('invoice_date')
            ->get();

        return response()->json([
            'success' => true,
            'data' => SupplierInvoiceResource::collection($invoices),
        ]);
    }

    /**
     * إنشاء فاتورة مورد.
     */
    public function store(
        StoreSupplierInvoiceRequest $request
    ): JsonResponse {
        $invoice = $this->invoiceService->create(
            $request->validated()
        );

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء فاتورة المورد بنجاح.',
            'data' => new SupplierInvoiceResource($invoice),
        ], 201);
    }

    /**
     * عرض فاتورة مورد.
     */
    public function show(
        SupplierInvoice $supplierInvoice
    ): JsonResponse {
        $supplierInvoice->load('supplier');

        return response()->json([
            'success' => true,
            'data' => new SupplierInvoiceResource($supplierInvoice),
        ]);
    }

    /**
     * تحديث فاتورة مورد.
     */
    public function update(
        StoreSupplierInvoiceRequest $request,
        SupplierInvoice $supplierInvoice
    ): JsonResponse {
        $invoice = $this->invoiceService->update(
            $supplierInvoice,
            $request->validated()
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث فاتورة المورد بنجاح.',
            'data' => new SupplierInvoiceResource($invoice),
        ]);
    }

    /**
     * حذف فاتورة مورد.
     */
    public function destroy(
        SupplierInvoice $supplierInvoice
    ): JsonResponse {
        $supplierInvoice->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف فاتورة المورد بنجاح.',
        ]);
    }
}