<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web routes
|--------------------------------------------------------------------------
| In production the compiled Vue app is served from backend/public/ and every
| path that is not /api or a real file falls back to index.html.
*/

Route::get('/{any?}', function () {
    $index = public_path('index.html');

    if (! file_exists($index)) {
        return response('ExpenseDesk API is running. Build the frontend to serve the app.', 200)
            ->header('Content-Type', 'text/plain');
    }

    return response()->file($index);
})->where('any', '^(?!api).*$');
