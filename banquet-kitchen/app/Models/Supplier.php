<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    // إيقاف حقول الوقت الافتراضية
    public $timestamps = false;

    // الحقول المسموح بإدخال البيانات فيها
    protected $fillable = [
        'name', 
        'phone', 
        'notes', 
        'is_active'
    ];

    // المورد لديه أكثر من فاتورة
    public function invoices()
    {
        return $this->hasMany(SupplierInvoice::class);
    }

    // المورد لديه أكثر من دفعة مالية
    public function payments()
    {
        return $this->hasMany(SupplierPayment::class);
    }
}