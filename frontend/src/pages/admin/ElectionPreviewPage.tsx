import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, ExternalLink, Eye } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getElection } from "@/api/elections";
import { extractErrorMessage } from "@/api/client";
import type { Election } from "@/api/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionAlert } from "@/components/ui/action-alert";
import { PageLoadingState } from "@/components/ui/loading-state";

export function ElectionPreviewPage() {
  const params = useParams();
  const electionId = Number(params.id);

  const [election, setElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPreviewUrl, setShowPreviewUrl] = useState(false);

  useEffect(() => {
    const loadElection = async () => {
      try {
        setLoading(true);
        const data = await getElection(electionId);
        setElection(data);
        setError(null);
      } catch (loadError) {
        setError(extractErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    };

    if (!Number.isNaN(electionId)) {
      void loadElection();
    }
  }, [electionId]);

  const totalCandidates = useMemo(
    () => election?.positions.reduce((sum, position) => sum + position.candidates.length, 0) ?? 0,
    [election]
  );

  const canPreview = useMemo(() => {
    if (!election) {
      return false;
    }

    return election.status === "draft" && totalCandidates > 0;
  }, [election, totalCandidates]);

  const previewUrl = useMemo(() => `${window.location.origin}/preview/${electionId}`, [electionId]);

  const handleCopyPreviewUrl = async () => {
    try {
      await navigator.clipboard.writeText(previewUrl);
      setError(null);
      setSuccess("Preview URL copied.");
    } catch {
      setSuccess(null);
      setError("Unable to copy preview URL automatically.");
    }
  };

  if (loading) {
    return <PageLoadingState title="Loading test preview" subtitle="Preparing preview controls..." />;
  }

  if (!election) {
    return <p className="text-sm text-destructive">Election not found.</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <CardTitle>Test Preview - {election.title}</CardTitle>
          </div>
          <CardDescription>
            Preview the election as a voter would. Test preview submissions are never stored in official results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <ActionAlert tone="error" message={error} /> : null}
          {success ? <ActionAlert tone="success" message={success} autoHideMs={1000} onAutoHide={() => setSuccess(null)} /> : null}

          <div className="rounded-lg border bg-card p-4 text-sm text-foreground">
            <p>
              To launch preview, the election must be in <span className="font-semibold">draft</span> mode and must
              contain at least one position with at least one candidate.
            </p>
          </div>

          {election.status !== "draft" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="inline-flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4" />
                Test preview is only available when the election is in draft mode.
              </p>
            </div>
          ) : null}

          {totalCandidates === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="inline-flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4" />
                Add at least one candidate before launching preview.
              </p>
            </div>
          ) : null}

          <div className="rounded-lg border bg-slate-50 p-4">
            <p className="text-sm font-semibold text-foreground">Public Preview URL</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share this URL for test walkthrough while the election remains in draft mode.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPreviewUrl((current) => !current);
                }}
              >
                {showPreviewUrl ? "Hide" : "Show"}
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleCopyPreviewUrl()}>
                <Copy className="mr-2 h-4 w-4" />
                Copy URL
              </Button>
            </div>
            {showPreviewUrl ? (
              <p className="mt-3 rounded-md border bg-card px-3 py-2 text-sm text-foreground [overflow-wrap:anywhere]">
                {previewUrl}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={!canPreview}
              onClick={() => {
                window.open(previewUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Launch Election Preview
            </Button>

            <Button asChild variant="outline">
              <Link to="/admin/ballot">Back to Ballot</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
