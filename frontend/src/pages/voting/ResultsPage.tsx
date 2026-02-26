import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download } from "lucide-react";
import { downloadResultsCsv, getElectionResults } from "@/api/results";
import { extractErrorMessage } from "@/api/client";
import type { ElectionResult } from "@/api/types";
import { usePolling } from "@/hooks/usePolling";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PositionRankingCard } from "@/components/results/PositionRankingCard";
import { PageLoadingState } from "@/components/ui/loading-state";

export function ResultsPage() {
  const params = useParams();
  const electionId = Number(params.id);

  const [result, setResult] = useState<ElectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadResults = useCallback(async () => {
    try {
      const data = await getElectionResults(electionId);
      setResult(data);
      setError(null);
    } catch (resultError) {
      setError(extractErrorMessage(resultError));
    } finally {
      setLoading(false);
    }
  }, [electionId]);

  useEffect(() => {
    if (!Number.isNaN(electionId)) {
      void loadResults();
    }
  }, [electionId, loadResults]);

  usePolling(loadResults, 10000, !loading && Boolean(result));

  if (loading) {
    return <PageLoadingState title="Loading results" subtitle="Collecting latest vote totals..." />;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!result) {
    return <p className="text-sm text-muted-foreground">No result data available.</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{result.title} - Results</CardTitle>
          <CardDescription>Total Votes: {result.total_votes.toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="inline-flex items-center gap-2"
            onClick={() => {
              void downloadResultsCsv(result.id);
            }}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
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
