<?php

namespace App\Http\Controllers;

use App\Http\Requests\Restaurant\UpdateRestaurantRequest;
use App\Http\Resources\RestaurantResource;
use App\Models\Restaurant;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class RestaurantController extends Controller
{
    /**
     * عرض بيانات المطعم.
     */
    public function show(): JsonResponse
    {
        $restaurant = Restaurant::query()->first();

        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'بيانات المطعم غير موجودة.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => new RestaurantResource($restaurant),
        ]);
    }

    /**
     * تحديث بيانات المطعم.
     */
    public function update(
        UpdateRestaurantRequest $request
    ): JsonResponse {
        $restaurant = Restaurant::query()->first();

        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'بيانات المطعم غير موجودة.',
            ], 404);
        }

        $data = $request->validated();

        /*
         * إذا تم رفع شعار جديد:
         * نحذف الشعار القديم ثم نخزن الجديد.
         */
        if ($request->hasFile('logo')) {
            if ($restaurant->logo) {
                Storage::disk('public')->delete($restaurant->logo);
            }

            $data['logo'] = $request->file('logo')->store(
                'restaurant',
                'public'
            );
        }

        $restaurant->update($data);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث بيانات المطعم بنجاح.',
            'data' => new RestaurantResource($restaurant->fresh()),
        ]);
    }

    /**
     * حذف شعار المطعم فقط.
     */
    public function deleteLogo(): JsonResponse
    {
        $restaurant = Restaurant::query()->first();

        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'بيانات المطعم غير موجودة.',
            ], 404);
        }

        if ($restaurant->logo) {
            Storage::disk('public')->delete($restaurant->logo);

            $restaurant->update([
                'logo' => null,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'تم حذف شعار المطعم بنجاح.',
        ]);
    }
}