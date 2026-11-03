<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class RestoreCommand extends Command
{
    protected $signature = 'expensedesk:restore {backup? : The backup folder name, newest when omitted}';

    protected $description = 'Restore the SQLite database and the receipts folder from storage/app/backups';

    public function handle(): int
    {
        $disk = Storage::disk('backups');

        $name = $this->argument('backup');
        if (! $name) {
            $directories = collect($disk->directories())->sort()->values();
            $name = $directories->last();
        }

        if (! $name || ! $disk->exists($name.'/database.sqlite')) {
            $this->error('No backup was found.');

            return self::FAILURE;
        }

        $dbPath = config('database.connections.sqlite.database');
        if (! is_string($dbPath)) {
            $this->error('The SQLite database path is not configured.');

            return self::FAILURE;
        }

        file_put_contents($dbPath, $disk->get($name.'/database.sqlite'));

        $receipts = Storage::disk('receipts');
        $receipts->deleteDirectory('');
        foreach ($disk->allFiles($name.'/receipts') as $file) {
            $relative = substr($file, strlen($name.'/receipts/'));
            $receipts->put($relative, $disk->get($file));
        }

        $this->info('Restored backup '.$name);

        return self::SUCCESS;
    }
}
