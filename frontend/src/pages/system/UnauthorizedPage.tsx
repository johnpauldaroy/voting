import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Unauthorized</CardTitle>
          <CardDescription>You do not have permission to access this page.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Contact a system administrator if this is unexpected.</p>
        </CardContent>
      </Card>
    </div>
  );
}
