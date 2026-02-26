import { useMemo, useState } from "react";
import type { PositionResult, CandidateResult } from "@/api/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import defaultAvatar from "@/assets/default-avatar.svg";

const numberFormatter = new Intl.NumberFormat();
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "http://localhost:8000";

function toOrdinal(rank: number): string {
  const mod10 = rank % 10;
  const mod100 = rank % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${rank}st`;
  }

  if (mod10 === 2 && mod100 !== 12) {
    return `${rank}nd`;
  }

  if (mod10 === 3 && mod100 !== 13) {
    return `${rank}rd`;
  }

  return `${rank}th`;
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

function CandidateAvatar({ candidate }: { candidate: CandidateResult }) {
  const [imageError, setImageError] = useState(false);
  const imageUrl = resolveCandidateImage(candidate.photo_path);
  const showImage = Boolean(imageUrl) && !imageError;

  if (!showImage) {
    return (
      <img
        src={defaultAvatar}
        alt={`${candidate.name} default avatar`}
        className="h-16 w-16 shrink-0 rounded-full border object-cover"
      />
    );
  }

  return (
    <img
      src={imageUrl ?? undefined}
      alt={candidate.name}
      className="h-16 w-16 shrink-0 rounded-full border object-cover"
      onError={() => setImageError(true)}
    />
  );
}

interface PositionRankingCardProps {
  position: PositionResult;
}

export function PositionRankingCard({ position }: PositionRankingCardProps) {
  const ranked = useMemo(
    () =>
      [...position.candidates]
        .sort((a, b) => b.votes - a.votes)
        .map((candidate, index) => ({
          ...candidate,
          rank: index + 1,
        })),
    [position.candidates]
  );

  return (
    <Card>
      <CardHeader className="pb-1.5">
        <div>
          <CardTitle>{position.title}</CardTitle>
          <CardDescription>Total votes: {numberFormatter.format(position.total_votes)}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5 pt-1.5">
        {ranked.length === 0 ? (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            No candidates in this position.
          </div>
        ) : (
          ranked.map((candidate) => {
            const width = candidate.percentage > 0 ? Math.max(candidate.percentage, 2) : 0;

            return (
              <div key={candidate.id} className="rounded-xl border bg-card px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <div className="w-12 shrink-0 pt-1 text-xl font-extrabold text-muted-foreground">
                    {toOrdinal(candidate.rank)}
                  </div>

                  <CandidateAvatar candidate={candidate} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-extrabold text-foreground">{candidate.name}</p>

                    <div className="mt-0.5 flex flex-wrap items-end gap-1.5">
                      <p className="text-4xl font-extrabold leading-none text-primary">
                        {numberFormatter.format(candidate.votes)}
                      </p>
                      <p className="pb-0.5 text-xl text-muted-foreground">Votes</p>
                    </div>

                    <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${Math.min(width, 100)}%` }}
                      />
                    </div>

                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {candidate.percentage.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
