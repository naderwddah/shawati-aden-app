<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class BookingItem extends Model
{
    public $timestamps = false;
    protected $fillable = ['booking_id', 'item_name', 'quantity', 'unit_price', 'total_price'];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }
}