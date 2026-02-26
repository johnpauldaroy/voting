import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { createPosition, getElection, reorderPositions } from "@/api/elections";
import { extractErrorMessage } from "@/api/client";
import type { Election } from "@/api/types";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ActionAlert } from "@/components/ui/action-alert";
import { PageLoadingState } from "@/components/ui/loading-state";

const positionSchema = z
  .object({
    title: z.string().min(2, "Position title is required."),
    max_votes_allowed: z.number().int().min(1).max(100),
    min_votes_allowed: z.number().int().min(1).max(100),
  })
  .refine((values) => values.min_votes_allowed <= values.max_votes_allowed, {
    path: ["min_votes_allowed"],
    message: "Minimum must be less than or equal to maximum.",
  });

type PositionFormData = z.infer<typeof positionSchema>;

export function ManagePositionsPage() {
  const params = useParams();
  const electionId = Number(params.id);
  const { user } = useAuth();

  const [election, setElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reordering, setReordering] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PositionFormData>({
    resolver: zodResolver(positionSchema),
    defaultValues: {
      title: "",
      max_votes_allowed: 1,
      min_votes_allowed: 1,
    },
  });

  const loadElection = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getElection(electionId);
      setElection({
        ...data,
        positions: [...data.positions].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
      });
      setError(null);
    } catch (loadError) {
      setError(extractErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [electionId]);

  useEffect(() => {
    if (!Number.isNaN(electionId)) {
      void loadElection();
    }
  }, [electionId, loadElection]);

  const onSubmit = async (values: PositionFormData) => {
    if (isOpenElectionLockedForRole) {
      setError("Only super admins can manage positions while the election is open.");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setSubmitting(true);
      await createPosition(electionId, values);
      reset({
        title: "",
        max_votes_allowed: 1,
        min_votes_allowed: 1,
      });
      await loadElection();
      setSuccess("Position added successfully.");
    } catch (createError) {
      setSuccess(null);
      setError(extractErrorMessage(createError));
    } finally {
      setSubmitting(false);
    }
  };

  const orderedPositions = useMemo(
    () => [...(election?.positions ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [election?.positions]
  );

  const isOpenElectionLockedForRole = election?.status === "open" && user?.role !== "super_admin";

  const handleMovePosition = async (positionId: number, direction: "up" | "down") => {
    if (!election || election.status === "closed" || isOpenElectionLockedForRole) {
      return;
    }

    const currentIndex = orderedPositions.findIndex((position) => position.id === positionId);
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= orderedPositions.length) {
      return;
    }

    const reordered = [...orderedPositions];
    const current = reordered[currentIndex];
    reordered[currentIndex] = reordered[targetIndex];
    reordered[targetIndex] = current;

    const reorderedWithSort = reordered.map((position, index) => ({
      ...position,
      sort_order: index + 1,
    }));

    setElection((currentElection) =>
      currentElection
        ? {
            ...currentElection,
            positions: reorderedWithSort,
          }
        : currentElection
    );

    try {
      setReordering(true);
      setError(null);
      setSuccess(null);
      const updated = await reorderPositions(
        election.id,
        reorderedWithSort.map((position) => position.id)
      );

      setElection((currentElection) =>
        currentElection
          ? {
              ...currentElection,
              positions: [...updated].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
            }
          : currentElection
      );
      setSuccess("Position order updated.");
    } catch (reorderError) {
      setSuccess(null);
      setError(extractErrorMessage(reorderError));
      await loadElection();
    } finally {
      setReordering(false);
    }
  };

  if (loading) {
    return <PageLoadingState title="Loading election positions" subtitle="Fetching position order and constraints..." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manage Positions - {election?.title ?? "Election"}</CardTitle>
          <CardDescription>Add positions available for voting.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {isOpenElectionLockedForRole ? (
              <ActionAlert
                tone="warning"
                message="This election is open. Only super admins can manage positions while voting is ongoing."
              />
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="title">Position Title</Label>
              <Input id="title" disabled={isOpenElectionLockedForRole} {...register("title")} />
              {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold">Type</p>
              <p className="text-sm text-muted-foreground">Multiple Choice - Voters can select one or many options</p>
            </div>

            <div className="rounded-md border border-input bg-secondary/20 p-3">
              <p className="text-sm text-foreground">
                Voters can select a <span className="font-semibold">maximum of</span>{" "}
                <Input
                  id="max_votes_allowed"
                  type="number"
                  min={1}
                  max={100}
                  disabled={isOpenElectionLockedForRole}
                  className="mx-2 inline-flex h-10 w-24 align-middle"
                  {...register("max_votes_allowed", { valueAsNumber: true })}
                />{" "}
                and a <span className="font-semibold">minimum of</span>{" "}
                <Input
                  id="min_votes_allowed"
                  type="number"
                  min={1}
                  max={100}
                  disabled={isOpenElectionLockedForRole}
                  className="mx-2 inline-flex h-10 w-24 align-middle"
                  {...register("min_votes_allowed", { valueAsNumber: true })}
                />{" "}
                option(s).
              </p>
              {errors.max_votes_allowed ? (
                <p className="mt-2 text-sm text-destructive">{errors.max_votes_allowed.message}</p>
              ) : null}
              {errors.min_votes_allowed ? (
                <p className="mt-2 text-sm text-destructive">{errors.min_votes_allowed.message}</p>
              ) : null}
            </div>

            {error ? <ActionAlert tone="error" message={error} /> : null}
            {success ? (
              <ActionAlert tone="success" message={success} autoHideMs={1000} onAutoHide={() => setSuccess(null)} />
            ) : null}

            <Button type="submit" disabled={submitting || election?.status === "closed" || isOpenElectionLockedForRole}>
              {submitting ? "Saving..." : "Add Position"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Positions</CardTitle>
          <CardDescription>Move positions up/down. This order is used in voting and results pages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {orderedPositions.length ? (
            orderedPositions.map((position, index) => (
              <div key={position.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">
                      {index + 1}. {position.title}
                    </p>
                    <p className="text-muted-foreground">
                      Voters can select minimum of {position.min_votes_allowed ?? 1} and maximum of{" "}
                      {position.max_votes_allowed} option(s)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={reordering || election?.status === "closed" || isOpenElectionLockedForRole || index === 0}
                    onClick={() => {
                      void handleMovePosition(position.id, "up");
                    }}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      reordering ||
                      election?.status === "closed" ||
                      isOpenElectionLockedForRole ||
                      index === orderedPositions.length - 1
                    }
                    onClick={() => {
                      void handleMovePosition(position.id, "down");
                    }}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No positions created yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
