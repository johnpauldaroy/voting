import { useEffect, useState } from "react";
import { getAuditLogs } from "@/api/audit";
import { extractErrorMessage } from "@/api/client";
import type { AuditLog, PaginationMeta } from "@/api/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InlineLoadingState } from "@/components/ui/loading-state";

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await getAuditLogs(page, 25);
        setLogs(response.data);
        setMeta(response.meta);
        setError(null);
      } catch (loadError) {
        setError(extractErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [page]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
        <CardDescription>Track sensitive actions across the system.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <InlineLoadingState label="Loading logs..." /> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                <TableCell>{log.user?.email ?? "System"}</TableCell>
                <TableCell>{log.action}</TableCell>
                <TableCell>{log.description}</TableCell>
                <TableCell>{log.ip_address ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {meta?.current_page ?? 1} of {meta?.last_page ?? 1}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={Boolean(meta && page >= meta.last_page)}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
