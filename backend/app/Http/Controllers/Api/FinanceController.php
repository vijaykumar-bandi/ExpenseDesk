<?php

namespace App\Http\Controllers\Api;

use App\Models\Report;
use App\Models\Reimbursement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class FinanceController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $this->authorizeFinance($request);

        [$from, $to] = $this->period($request);

        $outstanding = Report::where('status', Report::STATUS_APPROVED);
        $paid = Reimbursement::whereBetween('payment_date', [$from, $to]);

        return response()->json([
            'outstanding_paise' => (int) (clone $outstanding)->sum('total_paise'),
            'outstanding_count' => (clone $outstanding)->count(),
            'paid_paise' => (int) (clone $paid)->sum('amount_paise'),
            'paid_count' => (clone $paid)->count(),
            'from' => $from,
            'to' => $to,
        ]);
    }

    public function outstanding(Request $request): JsonResponse
    {
        $this->authorizeFinance($request);

        $reports = Report::where('status', Report::STATUS_APPROVED)
            ->with(['employee', 'manager'])
            ->orderBy('decided_at')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $reports->map(fn (Report $r) => $r->toSummaryArray())->values()->all(),
        ]);
    }

    public function payments(Request $request): JsonResponse
    {
        $this->authorizeFinance($request);

        [$from, $to] = $this->period($request);
        $q = trim((string) $request->query('q', ''));

        $query = Reimbursement::query()
            ->with(['report.employee', 'recordedBy'])
            ->whereBetween('payment_date', [$from, $to]);

        if ($q !== '') {
            $query->where(function ($builder) use ($q) {
                $builder->where('payment_reference', 'like', '%'.$q.'%')
                    ->orWhereHas('report', function ($r) use ($q) {
                        $r->where('title', 'like', '%'.$q.'%')
                            ->orWhereHas('employee', fn ($e) => $e->where('name', 'like', '%'.$q.'%'));
                    });
            });
        }

        $payments = $query->orderByDesc('payment_date')->orderByDesc('id')->get();

        return response()->json([
            'data' => $payments->map(fn (Reimbursement $p) => $p->toApiArray())->values()->all(),
        ]);
    }

    private function authorizeFinance(Request $request): void
    {
        if (! $request->user()->isFinance() && ! $request->user()->isAdministrator()) {
            abort(403, 'You do not have access to this page');
        }
    }

    private function period(Request $request): array
    {
        $tz = config('expensedesk.timezone', 'Asia/Kolkata');
        $now = Carbon::now($tz);

        $from = $request->query('from') ?: $now->copy()->startOfMonth()->format('Y-m-d');
        $to = $request->query('to') ?: $now->copy()->endOfMonth()->format('Y-m-d');

        return [$from, $to];
    }
}
