<?php

namespace App\Http\Controllers\Api;

use App\Models\Receipt;
use App\Services\ReceiptStorage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReceiptController extends Controller
{
    public function __construct(private ReceiptStorage $receipts)
    {
    }

    public function show(Receipt $receipt): BinaryFileResponse
    {
        $this->authorizeReport('view', $receipt);

        $path = $this->receipts->path($receipt);

        return response()->file($path, [
            'Content-Type' => $receipt->mime_type,
            'Content-Disposition' => 'inline; filename="'.$receipt->file_name.'"',
        ]);
    }
}
