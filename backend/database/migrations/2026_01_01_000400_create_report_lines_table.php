<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained()->cascadeOnDelete();
            $table->date('expense_date');
            $table->foreignId('category_id')->constrained('categories');
            $table->string('merchant');
            $table->integer('amount_paise');
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index('report_id');
        });

        Schema::create('receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_line_id')->unique()->constrained('report_lines')->cascadeOnDelete();
            $table->string('path');
            $table->string('file_name');
            $table->string('mime_type');
            $table->integer('size');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('receipts');
        Schema::dropIfExists('report_lines');
    }
};
