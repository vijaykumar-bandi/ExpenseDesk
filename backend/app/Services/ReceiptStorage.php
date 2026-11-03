<?php

namespace App\Services;

use App\Models\Receipt;
use App\Models\ReportLine;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Receipts live under storage/app/receipts/<report_id>/<uuid>.<ext>, never under
 * public/, and are served only through GET /api/receipts/{id} after the policy check.
 */
class ReceiptStorage
{
    public function store(ReportLine $line, UploadedFile $file): Receipt
    {
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'bin');
        $name = Str::uuid()->toString().'.'.$extension;
        $directory = (string) $line->report_id;

        Storage::disk('receipts')->putFileAs($directory, $file, $name);

        return Receipt::create([
            'report_line_id' => $line->id,
            'path' => $directory.'/'.$name,
            'file_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
            'size' => $file->getSize(),
            'created_at' => now(),
        ]);
    }

    public function delete(Receipt $receipt): void
    {
        Storage::disk('receipts')->delete($receipt->path);
        $receipt->delete();
    }

    public function path(Receipt $receipt): string
    {
        return Storage::disk('receipts')->path($receipt->path);
    }
}
