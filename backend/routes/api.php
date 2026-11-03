<?php

use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DecisionController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\FinanceController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\ReceiptController;
use App\Http\Controllers\Api\ReimbursementController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ReportLineController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API routes
|--------------------------------------------------------------------------
| Every route answers JSON. State-changing routes are protected by Laravel's
| CSRF middleware (the SPA sends X-XSRF-TOKEN from the XSRF-TOKEN cookie).
*/

Route::get('/health', HealthController::class);

Route::get('/csrf-cookie', [AuthController::class, 'csrfCookie']);

// AuthController counts only failed credentials. A named route throttle would
// count every request as well and make each failed login consume two attempts.
Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/categories', [CategoryController::class, 'index']);

    Route::get('/reports', [ReportController::class, 'index']);
    Route::post('/reports', [ReportController::class, 'store']);
    Route::get('/reports/{report}', [ReportController::class, 'show']);
    Route::patch('/reports/{report}', [ReportController::class, 'update']);
    Route::post('/reports/{report}/submit', [ReportController::class, 'submit']);
    Route::get('/reports/{report}/audit', [ReportController::class, 'audit']);

    Route::post('/reports/{report}/lines', [ReportLineController::class, 'store']);
    Route::patch('/reports/{report}/lines/{line}', [ReportLineController::class, 'update']);
    Route::delete('/reports/{report}/lines/{line}', [ReportLineController::class, 'destroy']);
    Route::post('/reports/{report}/lines/{line}/receipt', [ReportLineController::class, 'uploadReceipt']);
    Route::delete('/reports/{report}/lines/{line}/receipt', [ReportLineController::class, 'deleteReceipt']);

    Route::get('/receipts/{receipt}', [ReceiptController::class, 'show']);

    Route::post('/reports/{report}/decision', [DecisionController::class, 'store']);

    Route::get('/finance/summary', [FinanceController::class, 'summary']);
    Route::get('/finance/outstanding', [FinanceController::class, 'outstanding']);
    Route::get('/finance/payments', [FinanceController::class, 'payments']);
    Route::get('/finance/export.csv', [ExportController::class, 'csv']);
    Route::post('/reports/{report}/reimbursement', [ReimbursementController::class, 'store']);

    Route::get('/admin/users', [AdminUserController::class, 'index']);
    Route::post('/admin/users', [AdminUserController::class, 'store']);
    Route::patch('/admin/users/{user}', [AdminUserController::class, 'update']);
    Route::post('/admin/reports/{report}/reassign', [AdminUserController::class, 'reassign']);
    Route::get('/admin/categories', [CategoryController::class, 'adminIndex']);
    Route::post('/admin/categories', [CategoryController::class, 'store']);
    Route::patch('/admin/categories/{category}', [CategoryController::class, 'update']);
    Route::get('/admin/audit', [AuditController::class, 'index']);
});

// The audit history is append-only: no update or delete path exists.
Route::match(['patch', 'put', 'delete'], '/audit-events/{id}', function () {
    return response()->json(['message' => 'Method Not Allowed'], 405);
});
