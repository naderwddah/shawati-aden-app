<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    // 1. إخبار لارافيل أن هذا الجدول لا يحتوي على created_at و updated_at
    public $timestamps = false;

    // 2. الحقول المسموح بإدخال البيانات فيها
    protected $fillable = [
        'name', 
        'phone', 
        'notes', 
        'is_active'
    ];

    // 3. العلاقات
    // العميل لديه أكثر من حجز (One-to-Many)
    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }

    // العميل لديه أكثر من دفعة مالية
    public function payments()
    {
        return $this->hasMany(CustomerPayment::class);
    }
}