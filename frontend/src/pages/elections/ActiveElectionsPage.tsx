import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getElections } from "@/api/elections";
import { extractErrorMessage } from "@/api/client";
import type { Election } from "@/api/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InlineLoadingState } from "@/components/ui/loading-state";

export function ActiveElectionsPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getElections();
        setElections(data.filter((election) => election.status !== "draft"));
        setError(null);
      } catch (loadError) {
        setError(extractErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Elections</CardTitle>
        <CardDescription>Select an election to vote or view results.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <InlineLoadingState label="Loading elections..." /> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && !error && elections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active or closed elections found.</p>
        ) : null}

        {elections.map((election) => (
          <div key={election.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{election.title}</p>
                <Badge variant={election.status === "open" ? "default" : "secondary"}>{election.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{election.description ?? "No description provided."}</p>
            </div>

            <div className="flex gap-2">
              {election.status === "open" ? (
                <Button asChild>
                  <Link to={`/voting/${election.id}`}>Vote Now</Link>
                </Button>
              ) : null}
              {election.status === "closed" ? (
                <Button variant="outline" asChild>
                  <Link to={`/results/${election.id}`}>View Results</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
