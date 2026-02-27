import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleHelp, ListChecks, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getDashboardOverview } from "@/api/dashboard";
import { extractErrorMessage } from "@/api/client";
import type { DashboardOverview } from "@/api/types";
import { usePolling } from "@/hooks/usePolling";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoadingState } from "@/components/ui/loading-state";

export function AdminDashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const data = await getDashboardOverview();
      setOverview(data);
      setError(null);
    } catch (loadError) {
      setError(extractErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  usePolling(loadOverview, 15000, !loading && Boolean(overview));

  const peakHour = useMemo(() => {
    if (!overview) {
      return "00:00";
    }

    const top = [...overview.votes_per_hour].sort((a, b) => b.votes - a.votes)[0];
    return top?.hour ?? "00:00";
  }, [overview]);

  if (loading) {
    return <PageLoadingState title="Loading dashboard metrics" subtitle="Aggregating hourly ballot activity..." />;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!overview) {
    return <p className="text-sm text-muted-foreground">No dashboard data available.</p>;
  }

  const totalVotersVotedToday = overview.total_voters_voted_today ?? overview.voters_participated_today;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Voters Voted By Hour</CardTitle>
          <CardDescription>
            Date: {overview.time_range.date} | No. of voters voted today: {totalVotersVotedToday} | Peak hour: {peakHour}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview.votes_per_hour} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="votesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1ea7f0" stopOpacity={0.75} />
                    <stop offset="95%" stopColor="#1ea7f0" stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#d8e5f2" strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fill: "#6f7c8f", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#6f7c8f", fontSize: 11 }} />
                <Tooltip formatter={(value) => [value, "Voters Voted"]} />
                <Area
                  type="monotone"
                  dataKey="votes"
                  stroke="#1ea7f0"
                  fillOpacity={1}
                  fill="url(#votesGradient)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Quick Look</CardTitle>
          <CardDescription>Instant visibility for participation and ballot scale.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-[#21bf0a] p-4 text-white shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <CheckCircle2 className="h-8 w-8 text-white/90" />
                <p className="text-4xl font-extrabold">{overview.participation_percentage_today.toFixed(2)}%</p>
              </div>
              <p className="mt-3 text-sm font-semibold">Participation Today</p>
              <p className="text-sm text-white/90">
                ({overview.voters_participated_today.toLocaleString()} of {overview.total_voters.toLocaleString()} voters)
              </p>
            </div>

            <div className="rounded-xl bg-[#ff7700] p-4 text-white shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <Users className="h-8 w-8 text-white/90" />
                <p className="text-5xl font-extrabold">{overview.total_voters.toLocaleString()}</p>
              </div>
              <p className="mt-3 text-sm font-semibold">Voters</p>
              <p className="text-sm text-white/90">Active eligible voters</p>
            </div>

            <div className="rounded-xl bg-[#ec0178] p-4 text-white shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <CircleHelp className="h-8 w-8 text-white/90" />
                <p className="text-5xl font-extrabold">{overview.total_positions.toLocaleString()}</p>
              </div>
              <p className="mt-3 text-sm font-semibold">Ballot Positions</p>
              <p className="text-sm text-white/90">Total positions across elections</p>
            </div>

            <div className="rounded-xl bg-[#5433c2] p-4 text-white shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <ListChecks className="h-8 w-8 text-white/90" />
                <p className="text-5xl font-extrabold">{overview.total_candidates.toLocaleString()}</p>
              </div>
              <p className="mt-3 text-sm font-semibold">Options</p>
              <p className="text-sm text-white/90">Total candidates on ballots</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
