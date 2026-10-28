<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_invoices', function (Blueprint $table) {
            $table->id();

            $table->foreignId('supplier_id')
                ->constrained('suppliers')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            $table->string('invoice_number', 100)->nullable();
            $table->date('invoice_date');
            $table->text('details');
            $table->decimal('total_amount', 12, 2);
            $table->text('notes')->nullable();

            $table->index('supplier_id');
            $table->index('invoice_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_invoices');
    }
};