<?php

namespace App\Http\Controllers;

use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(
        private ReportService $reportService
    ) {
    }

    /**
     * الملخص اليومي.
     *
     * ?date=2026-09-02
     */
    public function dailySummary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['nullable', 'date'],
        ]);

        $date = $validated['date'] ?? now()->toDateString();

        return response()->json([
            'success' => true,
            'data' => $this->reportService->dailySummary($date),
        ]);
    }

    /**
     * الحجوزات حسب التاريخ.
     *
     * ?date=2026-09-02
     */
    public function bookingsByDate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['required', 'date'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->reportService->bookingsByDate(
                $validated['date']
            ),
        ]);
    }

    /**
     * الحجوزات القادمة.
     *
     * ?days=7
     */
    public function upcomingBookings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $days = $validated['days'] ?? 7;

        return response()->json([
            'success' => true,
            'data' => $this->reportService->upcomingBookings($days),
        ]);
    }

    /**
     * ملخص حسابات العملاء.
     */
    public function customerAccountsSummary(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->reportService->customerAccountsSummary(),
        ]);
    }

    /**
     * ملخص حسابات الموردين.
     */
    public function supplierAccountsSummary(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->reportService->supplierAccountsSummary(),
        ]);
    }

    /**
     * الملخص المالي حسب فترة زمنية.
     *
     * ?from_date=2026-09-01&to_date=2026-09-30
     */
    public function financialSummary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_date' => ['nullable', 'date'],
            'to_date' => [
                'nullable',
                'date',
                'after_or_equal:from_date',
            ],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->reportService->financialSummary(
                $validated['from_date'] ?? null,
                $validated['to_date'] ?? null
            ),
        ]);
    }
}