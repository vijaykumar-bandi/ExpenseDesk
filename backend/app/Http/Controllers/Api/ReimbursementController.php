<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ReportConflictException;
use App\Http\Requests\ReimbursementRequest;
use App\Models\Report;
use App\Services\ReimbursementService;
use Illuminate\Http\JsonResponse;

class ReimbursementController extends Controller
{
    public function __construct(private ReimbursementService $reimbursements)
    {
    }

    public function store(ReimbursementRequest $request, Report $report): JsonResponse
    {
        if (! $request->user()->isFinance()) {
            return response()->json(['message' => 'You do not have access to this page'], 403);
        }

        try {
            $reimbursement = $this->reimbursements->record(
                $report,
                $request->user(),
                (string) $request->input('payment_date'),
                (string) $request->input('payment_reference'),
            );
        } catch (ReportConflictException $e) {
            return response()->json(['message' => 'This report was already paid'], 409);
        }

        return response()->json(['data' => $reimbursement->toApiArray()], 201);
    }
}
