<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only super admins can view audit logs.',
            ], 403);
        }

        $query = AuditLog::query()
            ->with('user:id,name,email')
            ->orderByDesc('created_at');

        if ($request->filled('action')) {
            $query->where('action', 'like', '%'.$request->string('action').'%');
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->integer('user_id'));
        }

        $logs = $query->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => AuditLogResource::collection($logs->getCollection()),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}
