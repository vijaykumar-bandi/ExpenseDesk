<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isAdministrator()) {
            return response()->json(['message' => 'You do not have access to this page'], 403);
        }

        $query = AuditEvent::query()->with(['actor', 'previousManager', 'newManager']);

        if ($request->query('report_id')) {
            $query->where('report_id', (int) $request->query('report_id'));
        }

        $page = $query->orderByDesc('id')->paginate(50);

        return response()->json([
            'data' => collect($page->items())->map(fn (AuditEvent $e) => $e->toApiArray())->values()->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }
}
