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
        $deposit = (float) ($this->plate_deposit ?? 0);
        $returned = (float) ($this->plate_deposit_returned ?? 0);
        $payable = round($totalAmount + $deposit, 2);

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

            'items_quantity' => (float) ($this->items_sum_quantity ?? 0),
            'items' => BookingItemResource::collection($this->whenLoaded('items')),

            'total_amount' => $totalAmount,

            // total_amount remains items-only for backward compatibility.
            'payable_total' => $payable,
            'net_collected' => round($paidAmount - $returned, 2),
            'plate_deposit_pending_return' => round(max(0, $deposit - $returned), 2),
            'paid_amount' => $paidAmount,

            'remaining_amount' => max(
                0,
                $payable - $paidAmount
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
