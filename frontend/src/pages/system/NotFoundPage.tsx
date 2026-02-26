import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Page Not Found</CardTitle>
          <CardDescription>The route you requested does not exist.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/">Return Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
