import { CalendarCheck2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AttendancePage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5" />
            Attendance
          </CardTitle>
          <CardDescription>Track attendance records and monitor participation data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Attendance module is ready in navigation. You can now connect this page to your attendance API and tables.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
