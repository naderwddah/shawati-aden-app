<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class SupplierInvoice extends Model
{
    public $timestamps = false;
    protected $fillable = ['supplier_id', 'invoice_number', 'invoice_date', 'details', 'total_amount', 'notes'];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }
}