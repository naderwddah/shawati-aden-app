<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();

            $table->foreignId('customer_id')
                ->constrained('customers')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            $table->dateTime('invoice_date');
            $table->date('event_date');
            $table->time('delivery_time');
            $table->string('delivery_period', 20);
            $table->text('delivery_address');
            $table->string('mark', 255)->nullable();

            $table->decimal('total_amount', 12, 2);

            $table->decimal('plate_deposit', 12, 2)
                ->nullable();

            $table->decimal('plate_deposit_returned', 12, 2)
                ->nullable();

            $table->string('status', 20)->default('new');
            $table->text('notes')->nullable();

            $table->index('event_date');
            $table->index('status');
            $table->index(['event_date', 'delivery_time']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};