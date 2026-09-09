<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_payments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('customer_id')
                ->constrained('customers')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            $table->foreignId('booking_id')
                ->nullable()
                ->constrained('bookings')
                ->cascadeOnUpdate()
                ->nullOnDelete();

            $table->decimal('amount', 12, 2);

            $table->foreignId('payment_method_id')
                ->constrained('payment_methods')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            $table->dateTime('payment_date');
            $table->text('notes')->nullable();

            $table->index('customer_id');
            $table->index('booking_id');
            $table->index('payment_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_payments');
    }
};