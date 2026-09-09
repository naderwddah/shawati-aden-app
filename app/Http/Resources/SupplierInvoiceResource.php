<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupplierInvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'supplier_id' => $this->supplier_id,
            'invoice_number' => $this->invoice_number,
            'invoice_date' => $this->invoice_date,
            'details' => $this->details,
            'total_amount' => (float) $this->total_amount,
            'notes' => $this->notes,
        ];
    }
}