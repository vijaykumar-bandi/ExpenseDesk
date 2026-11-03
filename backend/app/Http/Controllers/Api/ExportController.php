<?php

namespace App\Http\Controllers\Api;

use App\Models\Reimbursement;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    public function csv(Request $request): StreamedResponse
    {
        if (! $request->user()->isFinance() && ! $request->user()->isAdministrator()) {
            abort(403, 'You do not have access to this page');
        }

        $tz = config('expensedesk.timezone', 'Asia/Kolkata');
        $now = Carbon::now($tz);
        $from = $request->query('from') ?: $now->copy()->startOfMonth()->format('Y-m-d');
        $to = $request->query('to') ?: $now->copy()->endOfMonth()->format('Y-m-d');
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

        $payments = $query->orderBy('payment_date')->orderBy('id')->get();

        return response()->streamDownload(function () use ($payments) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Payment date', 'Payment reference', 'Employee', 'Report title', 'Amount in INR']);

            foreach ($payments as $payment) {
                fputcsv($out, [
                    $payment->payment_date?->format('Y-m-d'),
                    self::safeCsvText($payment->payment_reference),
                    self::safeCsvText($payment->report?->employee?->name),
                    self::safeCsvText($payment->report?->title),
                    number_format($payment->amount_paise / 100, 2, '.', ''),
                ]);
            }

            fclose($out);
        }, 'expensedesk-payments.csv', ['Content-Type' => 'text/csv']);
    }

    private static function safeCsvText(?string $value): string
    {
        if ($value !== null && preg_match('/^[=+\-@]/', $value) === 1) {
            return "'".$value;
        }

        return $value ?? '';
    }
}
