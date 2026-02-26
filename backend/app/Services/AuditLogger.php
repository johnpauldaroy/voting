<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Throwable;

class AuditLogger
{
    public static function log(Request $request, string $action, string $description, ?int $userId = null): AuditLog
    {
        $payload = [
            'user_id' => $userId ?? optional($request->user())->id,
            'action' => $action,
            'description' => $description,
            'ip_address' => $request->ip(),
        ];

        try {
            return AuditLog::create($payload);
        } catch (Throwable $exception) {
            // Never block authentication and core actions if audit persistence fails.
            error_log('AuditLogger failure: '.$exception->getMessage());

            return new AuditLog($payload);
        }
    }
}
