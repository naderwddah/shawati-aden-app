<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class SupplierPayment extends Model
{
    public $timestamps = false;
    protected $fillable = ['supplier_id', 'amount', 'payment_method_id', 'payment_date', 'notes'];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function paymentMethod()
    {
        return $this->belongsTo(PaymentMethod::class);
    }
}