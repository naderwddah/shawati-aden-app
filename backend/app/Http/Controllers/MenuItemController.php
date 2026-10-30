<?php

namespace App\Http\Controllers;

use App\Models\MenuItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

/** Menu published to guests is read-only; admin operations stay behind Sanctum. */
class MenuItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return $this->listing($request, false);
    }

    public function publicIndex(Request $request): JsonResponse
    {
        return $this->listing($request, true);
    }

    private function listing(Request $request, bool $public): JsonResponse
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:150'],
            'status' => ['nullable', Rule::in(['all', 'published', 'hidden'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:48'],
        ]);

        $query = MenuItem::query()->with('media');
        if ($public) {
            $query->where('is_published', true);
        } else {
            if ($request->input('status') === 'published') $query->where('is_published', true);
            if ($request->input('status') === 'hidden') $query->where('is_published', false);
        }
        $query->when($request->filled('search'), function ($q) use ($request) {
                $search = $request->input('search');
                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', '%' . $search . '%')
                        ->orWhere('description', 'like', '%' . $search . '%');
                });
            });
        $page = $query->orderBy('sort_order')->orderByDesc('created_at')->orderByDesc('id')
            ->paginate((int) $request->input('per_page', 24));
        $result = [
            'success' => true,
            'data' => $page->getCollection()->map(fn (MenuItem $item) => $this->asData($item))->values(),
            'pagination' => [
                'page' => $page->currentPage(),
                'pages' => $page->lastPage(),
                'total' => $page->total(),
                'per_page' => $page->perPage(),
            ],
        ];
        if (!$public) {
            $result['counts'] = [
                'all' => MenuItem::count(),
                'published' => MenuItem::where('is_published', true)->count(),
                'hidden' => MenuItem::where('is_published', false)->count(),
            ];
        }
        return response()->json($result);
    }

    public function show(MenuItem $menuItem): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->asData($menuItem->load('media'))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules(false));
        $pathsCreated = [];
        try {
            $item = DB::transaction(function () use ($data, $request, &$pathsCreated) {
                $item = MenuItem::create($this->fields($data));
                $this->uploadMedia($request, $item, $pathsCreated);
                return $item;
            });
        } catch (Throwable $e) {
            Storage::disk('public')->delete($pathsCreated);
            throw $e;
        }
        return response()->json([
            'success' => true,
            'message' => 'تم إضافة المنتج إلى المنيو.',
            'data' => $this->asData($item->load('media')),
        ], 201);
    }

    public function update(Request $request, MenuItem $menuItem): JsonResponse
    {
        $data = $request->validate($this->rules(true));
        $removeIds = array_map('intval', $data['remove_media_ids'] ?? []);
        $mediaToRemove = $menuItem->media()->whereIn('id', $removeIds)->get();
        if (count($removeIds) !== $mediaToRemove->count()) {
            throw ValidationException::withMessages(['remove_media_ids' => 'بعض الملفات لا تنتمي إلى هذا المنتج.']);
        }
        $remainingImages = $menuItem->media()->where('type', 'image')
            ->whereNotIn('id', $removeIds)->count();
        $incomingImages = count($request->file('images', []));
        if ($remainingImages + $incomingImages > 6) {
            throw ValidationException::withMessages(['images' => 'يسمح بست صور كحد أقصى لكل منتج.']);
        }

        $pathsCreated = [];
        $pathsToDelete = $mediaToRemove->pluck('path')->all();
        try {
            DB::transaction(function () use ($request, $menuItem, $data, $removeIds, &$pathsCreated, &$pathsToDelete) {
                $menuItem->update($this->fields($data));
                if ($removeIds) $menuItem->media()->whereIn('id', $removeIds)->delete();
                if ($request->hasFile('video')) {
                    $oldVideo = $menuItem->media()->where('type', 'video')->get();
                    $pathsToDelete = array_merge($pathsToDelete, $oldVideo->pluck('path')->all());
                    $menuItem->media()->where('type', 'video')->delete();
                }
                $this->uploadMedia($request, $menuItem, $pathsCreated);
            });
        } catch (Throwable $e) {
            Storage::disk('public')->delete($pathsCreated);
            throw $e;
        }
        if ($pathsToDelete) Storage::disk('public')->delete(array_unique($pathsToDelete));
        return response()->json([
            'success' => true,
            'message' => 'تم تحديث المنتج.',
            'data' => $this->asData($menuItem->fresh('media')),
        ]);
    }

    public function destroy(MenuItem $menuItem): JsonResponse
    {
        $paths = $menuItem->media()->pluck('path')->all();
        $menuItem->delete();
        if ($paths) Storage::disk('public')->delete($paths);
        return response()->json(['success' => true, 'message' => 'تم حذف المنتج.']);
    }

    private function rules(bool $updating): array
    {
        $required = $updating ? ['sometimes', 'required'] : ['required'];
        return [
            'name' => [...$required, 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:3000'],
            'price' => [...$required, 'numeric', 'min:0', 'max:9999999999'],
            'is_published' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:99999'],
            'images' => ['sometimes', 'array', 'max:6'],
            'images.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:5120'],
            'video' => ['nullable', 'file', 'mimes:mp4,webm,mov', 'max:51200'],
            'remove_media_ids' => ['sometimes', 'array', 'max:8'],
            'remove_media_ids.*' => ['integer', 'distinct'],
        ];
    }

    private function fields(array $data): array
    {
        return array_intersect_key($data, array_flip([
            'name', 'description', 'price', 'is_published', 'sort_order',
        ]));
    }

    private function uploadMedia(Request $request, MenuItem $item, array &$pathsCreated): void
    {
        $currentImages = $item->media()->where('type', 'image')->count();
        foreach ($request->file('images', []) as $i => $file) {
            if ($currentImages + $i >= 6) {
                throw ValidationException::withMessages(['images' => 'الحد الأقصى ست صور.']);
            }
            $path = $file->store('menu-items/images', 'public');
            $pathsCreated[] = $path;
            $item->media()->create(['type' => 'image', 'path' => $path, 'sort_order' => $currentImages + $i]);
        }
        if ($request->hasFile('video')) {
            $path = $request->file('video')->store('menu-items/videos', 'public');
            $pathsCreated[] = $path;
            $item->media()->create(['type' => 'video', 'path' => $path, 'sort_order' => 99]);
        }
    }

    private function asData(MenuItem $item): array
    {
        return [
            'id' => $item->id,
            'name' => $item->name,
            'description' => $item->description,
            'price' => (float) $item->price,
            'is_published' => (bool) $item->is_published,
            'sort_order' => (int) $item->sort_order,
            'media' => $item->media->map(fn ($medium) => [
                'id' => $medium->id,
                'type' => $medium->type,
                'url' => url(Storage::disk('public')->url($medium->path)),
            ])->values(),
            'created_at' => $item->created_at?->toIso8601String(),
            'updated_at' => $item->updated_at?->toIso8601String(),
        ];
    }
}
