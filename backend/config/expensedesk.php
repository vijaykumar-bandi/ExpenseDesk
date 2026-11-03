<?php

return [
    // The live app's first Administrator, created after the migrations when both
    // are set and no account exists yet. The development seeder is never run in production.
    'first_admin_email' => env('FIRST_ADMIN_EMAIL'),
    'first_admin_password' => env('FIRST_ADMIN_PASSWORD'),

    // Login rate limiting: 5 failed attempts per email per 15 minutes.
    'login_max_attempts' => 5,
    'login_decay_minutes' => 15,

    // A password reset link is valid for 60 minutes.
    'reset_token_minutes' => 60,

    // Receipts: PDF, JPEG or PNG up to 5 MB.
    'receipt_max_kb' => 5120,
    'receipt_mimes' => ['application/pdf', 'image/jpeg', 'image/png'],

    // The "Waiting 3+ days" label.
    'waiting_days_threshold' => 3,

    'timezone' => 'Asia/Kolkata',
];
