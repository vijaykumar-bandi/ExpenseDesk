<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\StoreReportRequest;
use App\Http\Requests\UpdateReportRequest;
use App\Models\Report;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ReportController extends Controller
{
    public function __construct(private ReportService $reports)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $scope = (string) $request->query('scope', 'mine');
        $status = $request->query('status');

        $query = Report::query()->with(['employee', 'manager']);

        if ($scope === 'inbox' && $user->isManager()) {
            $query->where('manager_id', $user->id)->where('status', Report::STATUS_SUBMITTED);
        } else {
            $query->where('employee_id', $user->id);
        }

        if ($status) {
            $query->where('status', $status);
        }

        $reports = $query->orderByDesc('updated_at')->orderByDesc('id')->get();

        return response()->json([
            'data' => $reports->map(fn (Report $r) => $r->toSummaryArray())->values()->all(),
        ]);
    }

    public function store(StoreReportRequest $request): JsonResponse
    {
        $report = Report::create([
            'employee_id' => $request->user()->id,
            'title' => $request->input('title'),
            'business_purpose' => $request->input('business_purpose'),
            'status' => Report::STATUS_DRAFT,
            'total_paise' => 0,
        ]);

        return response()->json(['data' => $report->toApiArray()], 201);
    }

    public function show(Request $request, Report $report): JsonResponse
    {
        $this->authorizeReport('view', $report);

        return response()->json(['data' => $report->toApiArray()]);
    }

    public function update(UpdateReportRequest $request, Report $report): JsonResponse
    {
        $this->authorizeReport('update', $report);

        if (! $report->isEditable()) {
            throw ValidationException::withMessages([
                'status' => ['This report can no longer be edited'],
            ]);
        }

        $report->fill($request->only(['title', 'business_purpose']))->save();

        return response()->json(['data' => $report->refresh()->toApiArray()]);
    }

    public function submit(Request $request, Report $report): JsonResponse
    {
        $this->authorizeReport('submit', $report);

        $report = $this->reports->submit($report, $request->user());

        return response()->json(['data' => $report->toApiArray()]);
    }

    public function audit(Request $request, Report $report): JsonResponse
    {
        $this->authorizeReport('view', $report);

        $events = $report->auditEvents()->with(['actor', 'previousManager', 'newManager'])
            ->orderByDesc('id')->get();

        return response()->json([
            'data' => $events->map(fn ($e) => $e->toApiArray())->values()->all(),
        ]);
    }
}
