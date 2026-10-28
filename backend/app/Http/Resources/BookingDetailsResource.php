<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingDetailsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $itemsTotal = (float) ($this->total_amount ?? 0);
        $deposit = (float) ($this->plate_deposit ?? 0);
        $returned = (float) ($this->plate_deposit_returned ?? 0);
        $paid = (float) $this->payments->sum('amount');
        $payable = round($itemsTotal + $deposit, 2);

        return [
            'id' => $this->id,
            'customer_id' => $this->customer_id,
            'customer' => new CustomerResource($this->whenLoaded('customer')),

            'invoice_date' => $this->invoice_date,
            'event_date' => $this->event_date,
            'delivery_time' => $this->delivery_time,
            'delivery_period' => $this->delivery_period,
            'delivery_address' => $this->delivery_address,
            'mark' => $this->mark,

            'total_amount' => $itemsTotal,
            'payable_total' => $payable,
            'paid_amount' => $paid,
            'net_collected' => round($paid - $returned, 2),
            'remaining_amount' => round(max(0, $payable - $paid), 2),
            'plate_deposit_pending_return' => round(max(0, $deposit - $returned), 2),

            'plate_deposit' => $this->plate_deposit !== null
                ? (float) $this->plate_deposit
                : null,

            'plate_deposit_returned' => $this->plate_deposit_returned !== null
                ? (float) $this->plate_deposit_returned
                : null,

            'status' => $this->status,
            'notes' => $this->notes,

            'items' => BookingItemResource::collection(
                $this->whenLoaded('items')
            ),

            'payments' => CustomerPaymentResource::collection(
                $this->whenLoaded('payments')
            ),
        ];
    }
}