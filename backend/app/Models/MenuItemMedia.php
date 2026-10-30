<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MenuItemMedia extends Model
{
    protected $table = 'menu_item_media';

    protected $fillable = ['menu_item_id', 'type', 'path', 'sort_order'];

    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class);
    }
}
