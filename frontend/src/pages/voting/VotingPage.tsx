import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download } from "lucide-react";
import { z } from "zod";
import { getElection } from "@/api/elections";
import { castVote } from "@/api/voting";
import { extractErrorMessage } from "@/api/client";
import type { Election, VoteReceipt, VoteSelection } from "@/api/types";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/voting/ConfirmationModal";
import { CandidateSelectionOption } from "@/components/voting/CandidateSelectionOption";
import { ActionAlert } from "@/components/ui/action-alert";
import { PageLoadingState } from "@/components/ui/loading-state";
import defaultAvatar from "@/assets/default-avatar.svg";

const voteSchema = z.object({
  votes: z.array(
    z.object({
      position_id: z.number().int().positive(),
      candidate_id: z.number().int().positive(),
    })
  ),
});

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "http://localhost:8000";
const BALLOT_CACHE_TTL_MS = 60_000;

interface BallotReceiptData extends VoteReceipt {
  election_title: string;
  reference: string;
  selections: Array<{
    position_title: string;
    candidate_name: string;
  }>;
}

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

export function VotingPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const electionId = Number(params.id);

  const [election, setElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedByPosition, setSelectedByPosition] = useState<Record<number, number[]>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingVotes, setPendingVotes] = useState<VoteSelection[]>([]);
  const [ballotReceipt, setBallotReceipt] = useState<BallotReceiptData | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (Number.isNaN(electionId)) {
      setElection(null);
      setError("Invalid election link.");
      setLoading(false);
      return;
    }

    const cacheKey = `coop_vote_ballot_${electionId}`;
    let hasFreshCache = false;

    const cachedRaw = sessionStorage.getItem(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as { cached_at: number; data: Election };
        const cacheAge = Date.now() - cached.cached_at;

        if (cacheAge <= BALLOT_CACHE_TTL_MS && cached.data?.id === electionId) {
          setElection(cached.data);
          setError(null);
          setLoading(false);
          hasFreshCache = true;
        }
      } catch {
        // Ignore malformed cache and continue with network fetch.
      }
    }

    const load = async () => {
      try {
        if (!hasFreshCache) {
          setLoading(true);
        }
        const data = await getElection(electionId);
        if (cancelled) {
          return;
        }
        setElection(data);
        setError(null);
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            cached_at: Date.now(),
            data,
          })
        );
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(extractErrorMessage(loadError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [electionId]);

  const votePayload = useMemo(() => {
    return Object.entries(selectedByPosition).flatMap(([positionId, candidateIds]) =>
      candidateIds.map((candidateId) => ({
        position_id: Number(positionId),
        candidate_id: candidateId,
      }))
    );
  }, [selectedByPosition]);

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

  const handleVoteAttempt = () => {
    if (!election) {
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

        setError(constraintMessage);
        return;
      }
    }

    const parsed = voteSchema.safeParse({ votes: votePayload });

    if (!parsed.success) {
      setError("Please review your ballot selections before submitting.");
      return;
    }

    if (parsed.data.votes.length === 0) {
      setError("No votes selected.");
      return;
    }

    setPendingVotes(parsed.data.votes);
    setConfirmOpen(true);
  };

  const submitVote = async () => {
    if (!election) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const receipt = await castVote({
        election_id: electionId,
        votes: pendingVotes,
      });

      const selections = pendingVotes.map((vote) => {
        const position = election.positions.find((item) => item.id === vote.position_id);
        const candidate = position?.candidates.find((item) => item.id === vote.candidate_id);

        return {
          position_title: position?.title ?? `Position #${vote.position_id}`,
          candidate_name: candidate?.name ?? `Candidate #${vote.candidate_id}`,
        };
      });

      setBallotReceipt({
        ...receipt,
        election_title: election.title,
        reference: `BR-${receipt.election_id}-${new Date(receipt.submitted_at).getTime()}`,
        selections,
      });

      setConfirmOpen(false);
    } catch (voteError) {
      setError(extractErrorMessage(voteError));
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadReceipt = () => {
    if (!ballotReceipt) {
      return;
    }

    const lines = [
      "Coop Vote - Ballot Receipt",
      "----------------------------------------------",
      `Receipt Reference: ${ballotReceipt.reference}`,
      `Election: ${ballotReceipt.election_title} (#${ballotReceipt.election_id})`,
      `Submitted At: ${new Date(ballotReceipt.submitted_at).toLocaleString()}`,
      `Positions Voted: ${ballotReceipt.positions_voted}`,
      "",
      "Selections:",
      ...ballotReceipt.selections.map(
        (selection, index) => `${index + 1}. ${selection.position_title}: ${selection.candidate_name}`
      ),
      "",
      "Note: This receipt confirms successful submission in the system.",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date(ballotReceipt.submitted_at).toISOString().replace(/[:.]/g, "-");

    link.href = url;
    link.download = `ballot-receipt-election-${ballotReceipt.election_id}-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCancel = async () => {
    try {
      await logout();
    } finally {
      navigate(`/access/${electionId}`, { replace: true });
    }
  };

  if (loading) {
    return <PageLoadingState title="Loading election ballot" subtitle="Fetching positions and candidates..." />;
  }

  if (!election) {
    return <p className="text-sm text-destructive">Election not found.</p>;
  }

  if (ballotReceipt) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vote Submitted</CardTitle>
          <CardDescription>{ballotReceipt.message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">Ballot Receipt</p>
            <p className="mt-1 text-sm text-muted-foreground">Reference: {ballotReceipt.reference}</p>
            <p className="text-sm text-muted-foreground">
              Submitted: {new Date(ballotReceipt.submitted_at).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Positions voted: {ballotReceipt.positions_voted}</p>
            <div className="mt-3 space-y-1 text-sm text-foreground">
              {ballotReceipt.selections.map((selection) => (
                <p key={`${selection.position_title}-${selection.candidate_name}`}>
                  <span className="font-medium">{selection.position_title}:</span> {selection.candidate_name}
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={downloadReceipt}>
              <Download className="mr-2 h-4 w-4" />
              Download Receipt
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(`/access/${electionId}`, { replace: true })}>
              Back to QR Scan
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{election.title}</CardTitle>
          <CardDescription>Select candidates based on each position&apos;s minimum and maximum limits.</CardDescription>
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
                      inputName={maxVotesAllowed === 1 ? `position-${position.id}` : `position-${position.id}-${candidate.id}`}
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

          <div className="flex gap-2">
            <Button onClick={handleVoteAttempt} disabled={submitting || election.status !== "open"}>
              {submitting ? "Submitting..." : "Submit Vote"}
            </Button>
            <Button variant="outline" onClick={() => void handleCancel()}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmationModal
        open={confirmOpen}
        title="Confirm Vote Submission"
        description="Your vote is anonymous and cannot be changed after submission."
        confirmLabel="Confirm Vote"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          void submitVote();
        }}
      />

      {error ? (
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:right-6 sm:w-[440px]">
          <ActionAlert
            tone="error"
            message={error}
            autoHideMs={2600}
            onAutoHide={() => setError(null)}
            className="pointer-events-auto shadow-xl ring-1 ring-black/5"
          />
        </div>
      ) : null}
    </div>
  );
}
