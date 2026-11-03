<?php

namespace App\Http\Controllers\Api;

use App\Policies\ReportPolicy;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Gate;

abstract class Controller extends BaseController
{
    use AuthorizesRequests;

    /**
     * Authorizes an ability and answers a 403 with the report access message.
     */
    protected function authorizeReport(string $ability, mixed $arguments): void
    {
        if (! Gate::allows($ability, $arguments)) {
            throw new AuthorizationException(ReportPolicy::DENIED_MESSAGE);
        }
    }
}
