<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_lines', function (Blueprint $table) {
            $table->date('expense_date')->nullable()->change();
            $table->foreignId('category_id')->nullable()->change();
            $table->string('merchant')->nullable()->change();
            $table->integer('amount_paise')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Incomplete lines are valid only while this migration is applied. Remove
        // them before restoring the old NOT NULL schema so SQLite can rebuild the
        // table even after an Employee has saved a partially completed draft.
        DB::table('report_lines')
            ->where(function ($query) {
                $query->whereNull('expense_date')
                    ->orWhereNull('category_id')
                    ->orWhereNull('merchant')
                    ->orWhereNull('amount_paise');
            })
            ->delete();

        Schema::table('report_lines', function (Blueprint $table) {
            $table->date('expense_date')->nullable(false)->change();
            $table->foreignId('category_id')->nullable(false)->change();
            $table->string('merchant')->nullable(false)->change();
            $table->integer('amount_paise')->nullable(false)->change();
        });
    }
};
