<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentMethod extends Model
{
    public $timestamps = false;
    protected $fillable = ['name', 'is_active'];

    public function customerPayments()
    {
        return $this->hasMany(CustomerPayment::class);
    }

    public function supplierPayments()
    {
        return $this->hasMany(SupplierPayment::class);
    }
}