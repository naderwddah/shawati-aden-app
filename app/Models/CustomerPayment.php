<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class CustomerPayment extends Model
{
    public $timestamps = false;
    protected $fillable = ['customer_id', 'booking_id', 'amount', 'payment_method_id', 'payment_date', 'notes'];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
    
    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function paymentMethod()
    {
        return $this->belongsTo(PaymentMethod::class);
    }
}