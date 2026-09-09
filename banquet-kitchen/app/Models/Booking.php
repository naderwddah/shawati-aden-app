<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    // إيقاف حقول الوقت الافتراضية
    public $timestamps = false;

    // الحقول المسموح بإدخال البيانات فيها
    protected $fillable = [
        'customer_id', 
        'invoice_date', 
        'event_date', 
        'delivery_time',
        'delivery_period', 
        'delivery_address', 
        'mark', 
        'total_amount',
        'plate_deposit', 
        'plate_deposit_returned', 
        'status', 
        'notes'
    ];

    // الحجز ينتمي إلى عميل واحد
    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
    public function items()
    {
        return $this->hasMany(BookingItem::class);
    }

    public function payments()
    {
        return $this->hasMany(CustomerPayment::class);
    }
}