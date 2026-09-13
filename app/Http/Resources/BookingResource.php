<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $totalAmount = (float) ($this->total_amount ?? 0);
        $paidAmount = (float) ($this->payments_sum_amount ?? 0);

        return [
            'id' => $this->id,
            'customer_id' => $this->customer_id,

            'customer' => new CustomerResource(
                $this->whenLoaded('customer')
            ),

            'invoice_date' => $this->invoice_date,
            'event_date' => $this->event_date,
            'delivery_time' => $this->delivery_time,
            'delivery_period' => $this->delivery_period,
            'delivery_address' => $this->delivery_address,
            'mark' => $this->mark,

            'total_amount' => $totalAmount,

            'paid_amount' => $paidAmount,

            'remaining_amount' => max(
                0,
                $totalAmount - $paidAmount
            ),

            'plate_deposit' => $this->plate_deposit !== null
                ? (float) $this->plate_deposit
                : null,

            'plate_deposit_returned' => $this->plate_deposit_returned !== null
                ? (float) $this->plate_deposit_returned
                : null,

            'status' => $this->status,
            'notes' => $this->notes,
        ];
    }
}
