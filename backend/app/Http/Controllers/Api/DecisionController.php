<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ReportConflictException;
use App\Http\Requests\DecisionRequest;
use App\Models\Report;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;

class DecisionController extends Controller
{
    public function __construct(private ReportService $reports)
    {
    }

    public function store(DecisionRequest $request, Report $report): JsonResponse
    {
        if ($report->employee_id === $request->user()->id) {
            return response()->json(['message' => 'You cannot decide on your own report'], 403);
        }

        $this->authorize('decide', $report);

        try {
            $report = $this->reports->decide(
                $report,
                $request->user(),
                (string) $request->input('decision'),
                $request->input('reason'),
            );
        } catch (ReportConflictException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'data' => $e->report->toApiArray(),
            ], 409);
        }

        return response()->json(['data' => $report->toApiArray()]);
    }
}
