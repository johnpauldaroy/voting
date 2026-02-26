import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getElection, updateElection } from "@/api/elections";
import { extractErrorMessage } from "@/api/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ActionAlert } from "@/components/ui/action-alert";
import { Select } from "@/components/ui/select";
import { InlineLoadingState } from "@/components/ui/loading-state";

const electionSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().optional(),
  start_datetime: z.string().min(1, "Start date is required."),
  end_datetime: z.string().min(1, "End date is required."),
  status: z.enum(["draft", "open", "closed"]),
});

type ElectionFormData = z.infer<typeof electionSchema>;

function toDateTimeLocalValue(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

export function EditElectionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();
  const electionId = useMemo(() => Number(id), [id]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isElectionClosed, setIsElectionClosed] = useState(false);
  const [isOpenElectionLockedForRole, setIsOpenElectionLockedForRole] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ElectionFormData>({
    resolver: zodResolver(electionSchema),
    defaultValues: {
      title: "",
      description: "",
      start_datetime: "",
      end_datetime: "",
      status: "draft",
    },
  });

  useEffect(() => {
    const loadElection = async () => {
      if (!Number.isInteger(electionId) || electionId <= 0) {
        setError("Invalid election ID.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const election = await getElection(electionId);

        reset({
          title: election.title,
          description: election.description ?? "",
          start_datetime: toDateTimeLocalValue(election.start_datetime),
          end_datetime: toDateTimeLocalValue(election.end_datetime),
          status: election.status,
        });

        setIsElectionClosed(election.status === "closed");
        setIsOpenElectionLockedForRole(election.status === "open" && user?.role !== "super_admin");
        setError(null);
      } catch (loadError) {
        setIsElectionClosed(false);
        setIsOpenElectionLockedForRole(false);
        setError(extractErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    };

    void loadElection();
  }, [electionId, reset, user?.role]);

  const onSubmit = async (values: ElectionFormData) => {
    if (!Number.isInteger(electionId) || electionId <= 0) {
      setError("Invalid election ID.");
      return;
    }

    if (isElectionClosed) {
      setError("Closed elections are locked and cannot be modified.");
      return;
    }

    if (isOpenElectionLockedForRole) {
      setError("Only super admins can edit an election while it is open.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await updateElection(electionId, values);
      navigate("/admin/ballot", {
        state: {
          alert: {
            tone: "success",
            message: "Election updated successfully.",
          },
        },
      });
    } catch (updateError) {
      setError(extractErrorMessage(updateError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Election</CardTitle>
        <CardDescription>Update title, schedule, and status.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <InlineLoadingState label="Loading election..." /> : null}

        {!loading ? (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {isElectionClosed ? (
              <ActionAlert
                tone="warning"
                message="This election is closed and locked. Editing is disabled."
              />
            ) : null}
            {isOpenElectionLockedForRole ? (
              <ActionAlert
                tone="warning"
                message="This election is open. Editing is restricted to super admin accounts."
              />
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="title">Election Title</Label>
              <Input id="title" disabled={isElectionClosed || isOpenElectionLockedForRole} {...register("title")} />
              {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} disabled={isElectionClosed || isOpenElectionLockedForRole} {...register("description")} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_datetime">Start Date/Time</Label>
                <Input id="start_datetime" type="datetime-local" disabled={isElectionClosed || isOpenElectionLockedForRole} {...register("start_datetime")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_datetime">End Date/Time</Label>
                <Input id="end_datetime" type="datetime-local" disabled={isElectionClosed || isOpenElectionLockedForRole} {...register("end_datetime")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Closed" },
                ]}
                disabled={isElectionClosed || isOpenElectionLockedForRole}
                {...register("status")}
              />
            </div>

            {error ? <ActionAlert tone="error" message={error} /> : null}

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting || isElectionClosed || isOpenElectionLockedForRole}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/admin/ballot")}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
