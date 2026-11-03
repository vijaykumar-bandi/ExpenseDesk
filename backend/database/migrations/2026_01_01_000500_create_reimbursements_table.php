<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reimbursements', function (Blueprint $table) {
            $table->id();
            // The unique index is what makes a double-click, a retry or two Finance
            // users at once create exactly one reimbursement.
            $table->foreignId('report_id')->unique()->constrained()->cascadeOnDelete();
            $table->integer('amount_paise');
            $table->date('payment_date');
            $table->string('payment_reference');
            $table->foreignId('recorded_by')->constrained('users');
            $table->timestamp('created_at')->nullable();

            $table->index(['payment_date', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reimbursements');
    }
};
