<?php

namespace App\Http\Controllers;

use App\Http\Requests\Item\StoreItemRequest;
use App\Http\Requests\Item\UpdateItemRequest;
use App\Http\Resources\ItemResource;
use App\Models\Item;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ItemController extends Controller
{
    /**
     * قائمة الأصناف.
     */
    public function index(Request $request): JsonResponse
    {
        $items = Item::query()
            ->when(
                $request->filled('search'),
                function ($query) use ($request) {
                    $query->where(
                        'name',
                        'like',
                        '%' . $request->input('search') . '%'
                    );
                }
            )
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => ItemResource::collection($items),
        ]);
    }

    /**
     * إنشاء صنف.
     */
    public function store(StoreItemRequest $request): JsonResponse
    {
        $item = Item::create($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الصنف بنجاح.',
            'data' => new ItemResource($item),
        ], 201);
    }

    /**
     * عرض صنف.
     */
    public function show(Item $item): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => new ItemResource($item),
        ]);
    }

    /**
     * تحديث صنف.
     */
    public function update(
        UpdateItemRequest $request,
        Item $item
    ): JsonResponse {
        $item->update($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث الصنف بنجاح.',
            'data' => new ItemResource($item->fresh()),
        ]);
    }

    /**
     * حذف صنف.
     */
    public function destroy(Item $item): JsonResponse
    {
        $item->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الصنف بنجاح.',
        ]);
    }
}