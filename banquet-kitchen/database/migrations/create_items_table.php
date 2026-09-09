<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->decimal('default_price', 12, 2);
            $table->text('note')->nullable();

            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};