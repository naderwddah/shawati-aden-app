<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupplierPaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'supplier_id' => $this->supplier_id,
            'amount' => (float) $this->amount,
            'payment_method_id' => $this->payment_method_id,
            'payment_method' => new PaymentMethodResource(
                $this->whenLoaded('paymentMethod')
            ),
            'payment_date' => $this->payment_date,
            'notes' => $this->notes,
        ];
    }
}