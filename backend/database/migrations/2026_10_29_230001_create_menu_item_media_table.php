<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('menu_item_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('menu_item_id')->constrained('menu_items')->cascadeOnDelete();
            $table->string('type', 10); // image or video
            $table->string('path', 500);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['menu_item_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('menu_item_media');
    }
};
