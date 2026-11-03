<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\StoreCategoryRequest;
use App\Http\Requests\UpdateCategoryRequest;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = Category::where('active', true)->orderBy('name')->get();

        return response()->json([
            'data' => $categories->map(fn (Category $c) => $c->toApiArray())->values()->all(),
        ]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $categories = Category::orderBy('name')->get();

        return response()->json([
            'data' => $categories->map(fn (Category $c) => $c->toApiArray())->values()->all(),
        ]);
    }

    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $category = Category::create([
            'name' => $request->input('name'),
            'active' => true,
        ]);

        return response()->json(['data' => $category->toApiArray()], 201);
    }

    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        $this->authorizeAdmin($request);

        $category->fill($request->validated())->save();

        return response()->json(['data' => $category->refresh()->toApiArray()]);
    }

    private function authorizeAdmin(Request $request): void
    {
        if (! $request->user()->isAdministrator()) {
            abort(403, 'You do not have access to this page');
        }
    }
}
