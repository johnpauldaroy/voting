import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getElections } from "@/api/elections";
import { extractErrorMessage } from "@/api/client";
import type { Election } from "@/api/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/common/StatCard";
import { InlineLoadingState } from "@/components/ui/loading-state";

export function VoterDashboardPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getElections();
        setElections(data);
        setError(null);
      } catch (loadError) {
        setError(extractErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const stats = useMemo(() => {
    const active = elections.filter((election) => election.status === "open").length;
    const closed = elections.filter((election) => election.status === "closed").length;

    return { active, closed, total: elections.length };
  }, [elections]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Elections" value={stats.total} />
        <StatCard title="Open for Voting" value={stats.active} hint="You can vote once per election" />
        <StatCard title="Closed Elections" value={stats.closed} hint="Results available after closure" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Navigate to active elections and result dashboards.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/elections/active">View Active Elections</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/elections/active">Open Elections List</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Election Overview</CardTitle>
          <CardDescription>Latest elections available to representatives.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <InlineLoadingState label="Loading elections..." /> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!loading && !error && elections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No elections available.</p>
          ) : null}
          {!loading && !error
            ? elections.slice(0, 6).map((election) => (
                <div key={election.id} className="rounded-lg border p-3">
                  <p className="font-semibold">{election.title}</p>
                  <p className="text-sm text-muted-foreground">Status: {election.status}</p>
                </div>
              ))
            : null}
        </CardContent>
      </Card>
    </div>
  );
}
