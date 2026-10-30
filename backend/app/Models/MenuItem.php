<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MenuItem extends Model
{
    protected $fillable = [
        'name', 'description', 'price', 'is_published', 'sort_order',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_published' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function media(): HasMany
    {
        return $this->hasMany(MenuItemMedia::class)->orderBy('sort_order')->orderBy('id');
    }
}
