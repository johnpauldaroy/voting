<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            $key = $request->user()?->id ? 'user:'.$request->user()->id : 'ip:'.$request->ip();

            return [
                Limit::perMinute(120)->by($key),
            ];
        });

        RateLimiter::for('login', function (Request $request) {
            $identifier = (string) ($request->input('email') ?: $request->input('voter_id') ?: 'anonymous');

            return [
                Limit::perMinute(5)->by(strtolower($identifier).'|'.$request->ip()),
            ];
        });

        if (app()->environment('production') || (bool) env('FORCE_HTTPS', false)) {
            URL::forceScheme('https');
        }
    }
}
