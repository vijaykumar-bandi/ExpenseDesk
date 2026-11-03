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
            // Draft rows may be incomplete; submission validates every field.
            $table->date('expense_date')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('categories');
            $table->string('merchant')->nullable();
            $table->integer('amount_paise')->nullable();
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
