<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogger
{
    public static function log(Request $request, string $action, string $description, ?int $userId = null): AuditLog
    {
        return AuditLog::create([
            'user_id' => $userId ?? optional($request->user())->id,
            'action' => $action,
            'description' => $description,
            'ip_address' => $request->ip(),
        ]);
    }
}
