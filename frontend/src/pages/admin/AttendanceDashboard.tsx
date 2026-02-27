import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, UserCheck2, UserX, Users } from "lucide-react";
import { getAttendances } from "@/api/attendance";
import { extractErrorMessage } from "@/api/client";
import { getElections } from "@/api/elections";
import type { Attendance } from "@/api/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionAlert } from "@/components/ui/action-alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function AttendanceDashboard() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAttendances = useCallback(async (electionId: number) => {
    try {
      setLoading(true);
      const response = await getAttendances({
        election_id: electionId,
        per_page: 200,
      });
      setRecords(response.data);
      setSummary(response.summary);
      setError(null);
    } catch (loadError) {
      setError(extractErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const loadedElections = await getElections();

        if (loadedElections.length > 0) {
          const defaultElection =
            loadedElections.find((election) => election.status === "open") ?? loadedElections[0];
          await loadAttendances(defaultElection.id);
        }
      } catch (loadError) {
        setError(extractErrorMessage(loadError));
      }
    })();
  }, [loadAttendances]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5" />
            Attendance Dashboard
          </CardTitle>
          <CardDescription>Overview of attendance activity and participation trends.</CardDescription>
        </CardHeader>
      </Card>

      {error ? (
        <ActionAlert
          tone="error"
          message={error}
          autoHideMs={3000}
          onAutoHide={() => setError(null)}
          onClose={() => setError(null)}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-xl font-bold text-foreground">{summary.total}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Present</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-muted-foreground">
            <UserCheck2 className="h-4 w-4" />
            <span className="text-xl font-bold text-foreground">{summary.present}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Absent</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-muted-foreground">
            <UserX className="h-4 w-4" />
            <span className="text-xl font-bold text-foreground">{summary.absent}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance</CardTitle>
          <CardDescription>Attendance records for the selected election.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voter ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Attendance Status</TableHead>
                <TableHead>Already Voted</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && records.length === 0
                ? Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`attendance-skeleton-${index}`}>
                      <TableCell>
                        <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-40 animate-pulse rounded bg-secondary" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-28 animate-pulse rounded bg-secondary" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
                      </TableCell>
                      <TableCell>
                        <div className="h-6 w-20 animate-pulse rounded-full bg-secondary" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-10 animate-pulse rounded bg-secondary" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-16 animate-pulse rounded bg-secondary" />
                      </TableCell>
                    </TableRow>
                  ))
                : records.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.user?.voter_id ?? "-"}</TableCell>
                  <TableCell>{row.user?.name ?? "-"}</TableCell>
                  <TableCell>{row.user?.branch ?? "-"}</TableCell>
                  <TableCell>{row.checked_in_at ? new Date(row.checked_in_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>
                    {row.status === "present" ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Present</Badge>
                    ) : (
                      <Badge variant="secondary">Absent</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.user?.already_voted ? (
                      <span className="font-bold text-green-600">YES</span>
                    ) : (
                      <span className="text-muted-foreground">NO</span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{row.source}</TableCell>
                </TableRow>
                  ))}
              {!loading && records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No attendance records found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
