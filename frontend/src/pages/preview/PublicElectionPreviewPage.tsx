import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";
import { getElectionPreview } from "@/api/elections";
import { extractErrorMessage } from "@/api/client";
import type { Election } from "@/api/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionAlert } from "@/components/ui/action-alert";
import { PageLoadingState } from "@/components/ui/loading-state";
import { CandidateSelectionOption } from "@/components/voting/CandidateSelectionOption";
import defaultAvatar from "@/assets/default-avatar.svg";

const previewVoteSchema = z.object({
  votes: z.array(
    z.object({
      position_id: z.number().int().positive(),
      candidate_id: z.number().int().positive(),
    })
  ),
});

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "http://localhost:8000";

function resolveCandidateImage(photoPath: string | null): string | null {
  if (!photoPath) {
    return null;
  }

  if (photoPath.startsWith("http://") || photoPath.startsWith("https://")) {
    try {
      const parsed = new URL(photoPath);
      if (parsed.pathname.startsWith("/storage/") && parsed.origin !== API_ORIGIN) {
        return `${API_ORIGIN}${parsed.pathname}`;
      }
    } catch {
      return photoPath;
    }

    return photoPath;
  }

  if (photoPath.startsWith("data:") || photoPath.startsWith("blob:")) {
    return photoPath;
  }

  if (photoPath.startsWith("/")) {
    return `${API_ORIGIN}${photoPath}`;
  }

  const normalized = photoPath.replace(/^\/+/, "");
  return normalized.startsWith("storage/")
    ? `${API_ORIGIN}/${normalized}`
    : `${API_ORIGIN}/storage/${normalized}`;
}

export function PublicElectionPreviewPage() {
  const params = useParams();
  const electionId = Number(params.id);

  const [election, setElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedByPosition, setSelectedByPosition] = useState<Record<number, number[]>>({});
  const [previewExpired, setPreviewExpired] = useState(false);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        setLoading(true);
        const data = await getElectionPreview(electionId);
        setElection(data);
        setError(null);
        setPreviewExpired(false);
      } catch (loadError) {
        const message = extractErrorMessage(loadError);
        setError(message);
        setPreviewExpired(message.toLowerCase().includes("only available while election is in draft mode"));
      } finally {
        setLoading(false);
      }
    };

    if (!Number.isNaN(electionId)) {
      void loadPreview();
    }
  }, [electionId]);

  const previewSelections = useMemo(
    () =>
      Object.entries(selectedByPosition).flatMap(([positionId, candidateIds]) =>
        candidateIds.map((candidateId) => ({
          position_id: Number(positionId),
          candidate_id: candidateId,
        }))
      ),
    [selectedByPosition]
  );

  const handleSelectionChange = (position: Election["positions"][number], candidateId: number) => {
    const minVotesAllowed = Math.max(1, position.min_votes_allowed ?? 1);
    const maxVotesAllowed = Math.max(minVotesAllowed, position.max_votes_allowed ?? 1);

    setSelectedByPosition((current) => {
      const currentSelection = current[position.id] ?? [];
      const isSelected = currentSelection.includes(candidateId);

      if (maxVotesAllowed === 1) {
        setError(null);

        return {
          ...current,
          [position.id]: [candidateId],
        };
      }

      if (isSelected) {
        setError(null);

        return {
          ...current,
          [position.id]: currentSelection.filter((id) => id !== candidateId),
        };
      }

      if (currentSelection.length >= maxVotesAllowed) {
        setError(`You can only select up to ${maxVotesAllowed} option(s) for "${position.title}".`);
        return current;
      }

      setError(null);

      return {
        ...current,
        [position.id]: [...currentSelection, candidateId],
      };
    });
  };

  const handleSubmitPreview = () => {
    if (!election) {
      setSuccess(null);
      setError("Election data is not available.");
      return;
    }

    for (const position of election.positions) {
      const minVotesAllowed = Math.max(1, position.min_votes_allowed ?? 1);
      const maxVotesAllowed = Math.max(minVotesAllowed, position.max_votes_allowed ?? 1);
      const selectedCount = (selectedByPosition[position.id] ?? []).length;

      if (selectedCount < minVotesAllowed || selectedCount > maxVotesAllowed) {
        const constraintMessage =
          minVotesAllowed === maxVotesAllowed
            ? `Position "${position.title}" requires exactly ${minVotesAllowed} selection(s).`
            : `Position "${position.title}" requires between ${minVotesAllowed} and ${maxVotesAllowed} selection(s).`;

        setSuccess(null);
        setError(constraintMessage);
        return;
      }
    }

    const parsed = previewVoteSchema.safeParse({ votes: previewSelections });

    if (!parsed.success || parsed.data.votes.length === 0) {
      setSuccess(null);
      setError("Select at least one candidate to run a test preview.");
      return;
    }

    setError(null);
    setSuccess("Test preview submitted. This does not count toward official election results.");
  };

  if (loading) {
    return <PageLoadingState title="Loading election preview" subtitle="Preparing test ballot..." />;
  }

  if (!election) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <ActionAlert tone="error" message={error ?? "Preview election not found."} />
        {previewExpired ? (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Preview Link Expired</CardTitle>
              <CardDescription>
                This election is no longer in draft mode, so test preview is disabled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Use the voter access page instead for live voting access.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={`/access/${electionId}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Go to Voter Access
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/login">Back to Login</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{election.title} - Test Preview</CardTitle>
          <CardDescription>
            Preview mode is for testing only. Submissions here are never written to votes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {election.positions.map((position) => {
            const minVotesAllowed = Math.max(1, position.min_votes_allowed ?? 1);
            const maxVotesAllowed = Math.max(minVotesAllowed, position.max_votes_allowed ?? 1);
            const selectedCandidates = selectedByPosition[position.id] ?? [];

            return (
              <div key={position.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{position.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCandidates.length}/{maxVotesAllowed} selected
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select a minimum of {minVotesAllowed} and a maximum of {maxVotesAllowed} option(s).
                </p>

                <div className="mt-3 space-y-2">
                  {position.candidates.map((candidate) => (
                    <CandidateSelectionOption
                      key={candidate.id}
                      inputType={maxVotesAllowed === 1 ? "radio" : "checkbox"}
                      inputName={
                        maxVotesAllowed === 1
                          ? `preview-position-${position.id}`
                          : `preview-position-${position.id}-${candidate.id}`
                      }
                      checked={selectedCandidates.includes(candidate.id)}
                      onChange={() => handleSelectionChange(position, candidate.id)}
                      candidate={candidate}
                      resolveImage={resolveCandidateImage}
                      fallbackImage={defaultAvatar}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSubmitPreview}>
              Submit Test Vote
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedByPosition({});
                setError(null);
                setSuccess(null);
              }}
            >
              Reset
            </Button>
            <Button asChild type="button" variant="outline">
              <Link to="/login">Back to Login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 space-y-2 sm:inset-x-auto sm:right-6 sm:w-[440px]">
        {error ? (
          <ActionAlert
            tone="error"
            message={error}
            autoHideMs={2600}
            onAutoHide={() => setError(null)}
            className="pointer-events-auto shadow-xl ring-1 ring-black/5"
          />
        ) : null}
        {success ? (
          <ActionAlert
            tone="success"
            message={success}
            autoHideMs={1600}
            onAutoHide={() => setSuccess(null)}
            className="pointer-events-auto shadow-xl ring-1 ring-black/5"
          />
        ) : null}
      </div>
    </div>
  );
}
