import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Trophy, UserCheck, Vote } from "lucide-react";
import { downloadResultsCsv, getElectionResults } from "@/api/results";
import { extractErrorMessage } from "@/api/client";
import type { ElectionResult } from "@/api/types";
import { usePolling } from "@/hooks/usePolling";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PositionRankingCard } from "@/components/results/PositionRankingCard";
import { PageLoadingState } from "@/components/ui/loading-state";

export function ResultsDashboardPage() {
  const params = useParams();
  const electionId = Number(params.id);

  const [result, setResult] = useState<ElectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getElectionResults(electionId);
      setResult(data);
      setError(null);
    } catch (loadError) {
      setError(extractErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [electionId]);

  useEffect(() => {
    if (!Number.isNaN(electionId)) {
      void load();
    }
  }, [electionId, load]);

  usePolling(load, 8000, !loading && Boolean(result));

  if (loading) {
    return <PageLoadingState title="Loading results dashboard" subtitle="Calculating candidate rankings..." />;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!result) {
    return <p className="text-sm text-muted-foreground">No results found.</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Results Dashboard - {result.title}</CardTitle>
            <CardDescription>Live rank-based view per position with vote distribution.</CardDescription>
          </div>

          <Button
            variant="outline"
            className="inline-flex w-fit items-center gap-2 self-start sm:self-auto"
            onClick={() => {
              void downloadResultsCsv(result.id);
            }}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Total Votes</p>
              <div className="mt-2 flex items-center gap-2">
                <Vote className="h-4 w-4 text-primary" />
                <p className="text-2xl font-extrabold">{result.total_votes.toLocaleString()}</p>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Positions</p>
              <div className="mt-2 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <p className="text-2xl font-extrabold">{result.positions.length}</p>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">Voter Turnout</p>
              <div className="mt-2 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                <p className="truncate text-2xl font-extrabold">{result.voter_turnout_percentage.toFixed(2)}%</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.voters_participated.toLocaleString()} of {result.total_voters.toLocaleString()} voters
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {result.positions.map((position, index) => (
        <div key={position.id} className={index < 4 ? "animate-fade-up" : ""}>
          <PositionRankingCard position={position} />
        </div>
      ))}
    </div>
  );
}
