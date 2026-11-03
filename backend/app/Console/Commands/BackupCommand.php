<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BackupCommand extends Command
{
    protected $signature = 'expensedesk:backup';

    protected $description = 'Copy the SQLite database and the receipts folder into storage/app/backups';

    public function handle(): int
    {
        $stamp = now()->format('Ymd-His');
        $target = 'backup-'.$stamp;
        $disk = Storage::disk('backups');

        $dbPath = config('database.connections.sqlite.database');
        if (! is_string($dbPath) || ! file_exists($dbPath)) {
            $this->error('The SQLite database file was not found.');

            return self::FAILURE;
        }

        $disk->put($target.'/database.sqlite', file_get_contents($dbPath));

        $receipts = Storage::disk('receipts');
        foreach ($receipts->allFiles() as $file) {
            $disk->put($target.'/receipts/'.$file, $receipts->get($file));
        }

        $this->info('Backup written to storage/app/backups/'.$target);

        return self::SUCCESS;
    }
}
