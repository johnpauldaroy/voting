<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureHttps
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! app()->environment('production') && ! (bool) env('FORCE_HTTPS', false)) {
            return $next($request);
        }

        if (! $request->isSecure()) {
            return response()->json([
                'message' => 'HTTPS is required for this endpoint.',
            ], 403);
        }

        return $next($request);
    }
}
