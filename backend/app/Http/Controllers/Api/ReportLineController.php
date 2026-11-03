<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\StoreLineRequest;
use App\Http\Requests\UpdateLineRequest;
use App\Models\Report;
use App\Models\ReportLine;
use App\Services\ReceiptStorage;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ReportLineController extends Controller
{
    public function __construct(
        private ReportService $reports,
        private ReceiptStorage $receipts,
    ) {
    }

    public function store(StoreLineRequest $request, Report $report): JsonResponse
    {
        $this->authorize('update', $report);

        $line = $report->lines()->create($request->validated());
        $this->reports->recomputeTotal($report);

        return response()->json(['data' => $line->toApiArray()], 201);
    }

    public function update(UpdateLineRequest $request, Report $report, ReportLine $line): JsonResponse
    {
        $this->authorize('update', $report);
        $this->ensureLine($report, $line);

        $line->fill($request->validated())->save();
        $this->reports->recomputeTotal($report);

        return response()->json(['data' => $line->refresh()->toApiArray()]);
    }

    public function destroy(Request $request, Report $report, ReportLine $line): JsonResponse
    {
        $this->authorize('update', $report);
        $this->ensureLine($report, $line);

        if ($line->receipt) {
            $this->receipts->delete($line->receipt);
        }

        $line->delete();
        $this->reports->recomputeTotal($report);

        return response()->json(null, 204);
    }

    public function uploadReceipt(Request $request, Report $report, ReportLine $line): JsonResponse
    {
        $this->authorize('update', $report);
        $this->ensureLine($report, $line);

        $maxKb = (int) config('expensedesk.receipt_max_kb', 5120);

        $request->validate([
            'file' => ['required', 'file', 'max:'.$maxKb, 'mimes:pdf,jpg,jpeg,png'],
        ], [
            'file.mimes' => 'Receipts must be a PDF, JPEG or PNG of up to 5 MB',
            'file.max' => 'Receipts must be a PDF, JPEG or PNG of up to 5 MB',
            'file.required' => 'Receipts must be a PDF, JPEG or PNG of up to 5 MB',
        ]);

        if ($line->receipt) {
            $this->receipts->delete($line->receipt);
        }

        $receipt = $this->receipts->store($line, $request->file('file'));

        return response()->json([
            'data' => [
                'id' => $receipt->id,
                'file_name' => $receipt->file_name,
                'mime_type' => $receipt->mime_type,
                'size' => (int) $receipt->size,
            ],
        ], 201);
    }

    public function deleteReceipt(Request $request, Report $report, ReportLine $line): JsonResponse
    {
        $this->authorize('update', $report);
        $this->ensureLine($report, $line);

        if ($line->receipt) {
            $this->receipts->delete($line->receipt);
        }

        return response()->json(null, 204);
    }

    private function ensureLine(Report $report, ReportLine $line): void
    {
        if ($line->report_id !== $report->id) {
            throw ValidationException::withMessages(['line' => ['This line is not part of the report']]);
        }
    }
}
