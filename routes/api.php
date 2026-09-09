<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\CustomerPaymentController;
use App\Http\Controllers\SupplierPaymentController;
use App\Http\Controllers\SupplierInvoiceController;
use App\Http\Controllers\PaymentMethodController;
use App\Http\Controllers\RestaurantController;
use App\Http\Controllers\CustomerAccountController;
use App\Http\Controllers\SupplierAccountController;
use App\Http\Controllers\ReportController;

Route::post('login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {

    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);

    Route::apiResource('customers', CustomerController::class);

    Route::get(
        'customers/{customer}/account',
        [CustomerAccountController::class, 'show']
    );

    Route::get(
        'customers/{customer}/statement',
        [CustomerAccountController::class, 'statement']
    );

    Route::get(
        'customer-accounts',
        [CustomerAccountController::class, 'index']
    );

    Route::apiResource('suppliers', SupplierController::class);

    Route::get(
        'suppliers/{supplier}/account',
        [SupplierAccountController::class, 'show']
    );

    Route::get(
        'suppliers/{supplier}/statement',
        [SupplierAccountController::class, 'statement']
    );

    Route::get(
        'supplier-accounts',
        [SupplierAccountController::class, 'index']
    );

    Route::apiResource('items', ItemController::class);

    Route::apiResource('bookings', BookingController::class);

    Route::get(
        'bookings-by-date',
        [BookingController::class, 'byDate']
    );

    Route::get(
        'upcoming-bookings',
        [BookingController::class, 'upcoming']
    );

    Route::apiResource(
        'customer-payments',
        CustomerPaymentController::class
    )->only([
        'index',
        'store',
        'show',
        'destroy',
    ]);

    Route::apiResource(
        'supplier-payments',
        SupplierPaymentController::class
    )->only([
        'index',
        'store',
        'show',
        'destroy',
    ]);

    Route::apiResource(
        'supplier-invoices',
        SupplierInvoiceController::class
    );

    Route::apiResource(
        'payment-methods',
        PaymentMethodController::class
    );

    Route::get(
        'restaurant',
        [RestaurantController::class, 'show']
    );

    Route::put(
        'restaurant',
        [RestaurantController::class, 'update']
    );

    Route::post(
        'restaurant',
        [RestaurantController::class, 'update']
    );

    Route::delete(
        'restaurant/logo',
        [RestaurantController::class, 'deleteLogo']
    );

    Route::get(
        'reports/daily-summary',
        [ReportController::class, 'dailySummary']
    );

    Route::get(
        'reports/bookings-by-date',
        [ReportController::class, 'bookingsByDate']
    );

    Route::get(
        'reports/upcoming-bookings',
        [ReportController::class, 'upcomingBookings']
    );

    Route::get(
        'reports/customer-accounts',
        [ReportController::class, 'customerAccountsSummary']
    );

    Route::get(
        'reports/supplier-accounts',
        [ReportController::class, 'supplierAccountsSummary']
    );

    Route::get(
        'reports/financial-summary',
        [ReportController::class, 'financialSummary']
    );
});