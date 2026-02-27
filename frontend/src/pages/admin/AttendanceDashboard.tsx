import { CalendarCheck2, Clock3, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ATTENDANCE_ROWS = [
  { id: "VT-001", name: "Juan Dela Cruz", date: "2026-02-27", checkIn: "08:03 AM", status: "Present" },
  { id: "VT-002", name: "Maria Santos", date: "2026-02-27", checkIn: "08:21 AM", status: "Late" },
  { id: "VT-003", name: "Carlo Reyes", date: "2026-02-27", checkIn: "-", status: "Absent" },
  { id: "VT-004", name: "Ana Lopez", date: "2026-02-27", checkIn: "07:56 AM", status: "Present" },
];

export function AttendanceDashboard() {
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Present Today</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Connect attendance data to display totals.</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Late Check-ins</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            <span>Late arrivals summary will appear here.</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Absences</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-muted-foreground">
            <CalendarCheck2 className="h-4 w-4" />
            <span>Daily and historical absences will be shown here.</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance</CardTitle>
          <CardDescription>Latest attendance records for today.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voter ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ATTENDANCE_ROWS.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.checkIn}</TableCell>
                  <TableCell>
                    {row.status === "Present" ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Present</Badge>
                    ) : row.status === "Late" ? (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Late</Badge>
                    ) : (
                      <Badge variant="secondary">Absent</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
