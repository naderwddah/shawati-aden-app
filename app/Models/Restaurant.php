<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Restaurant extends Model
{
    // ملاحظة: لارافيل يفترض أن اسم الجدول هو مطابقة بصيغة الجمع للمودل (restaurants)
    // لكن في أوامر SQL الخاصة بك اسميته restaurant (بالمفرد)
    // لذلك يجب أن نخبر لارافيل باسم الجدول الحقيقي:
    protected $table = 'restaurant';
    
    public $timestamps = false;
    protected $fillable = ['name', 'description', 'phone', 'whatsapp', 'facebook', 'instagram', 'address', 'logo'];
}