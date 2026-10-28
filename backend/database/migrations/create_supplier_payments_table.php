<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_payments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('supplier_id')
                ->constrained('suppliers')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            $table->decimal('amount', 12, 2);

            $table->foreignId('payment_method_id')
                ->constrained('payment_methods')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            $table->dateTime('payment_date');
            $table->text('notes')->nullable();

            $table->index('supplier_id');
            $table->index('payment_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_payments');
    }
};