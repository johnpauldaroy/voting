import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createElection } from "@/api/elections";
import { extractErrorMessage } from "@/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ActionAlert } from "@/components/ui/action-alert";
import { Select } from "@/components/ui/select";

const electionSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().optional(),
  start_datetime: z.string().min(1, "Start date is required."),
  end_datetime: z.string().min(1, "End date is required."),
  status: z.enum(["draft", "open", "closed"]),
});

type ElectionFormData = z.infer<typeof electionSchema>;

export function CreateElectionPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
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

  const onSubmit = async (values: ElectionFormData) => {
    try {
      setSubmitting(true);
      setError(null);
      await createElection(values);
      navigate("/admin/ballot", {
        state: {
          alert: {
            tone: "success",
            message: "Election created successfully.",
          },
        },
      });
    } catch (createError) {
      setError(extractErrorMessage(createError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Election</CardTitle>
        <CardDescription>Define title, schedule, and initial status.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="title">Election Title</Label>
            <Input id="title" {...register("title")} />
            {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_datetime">Start Date/Time</Label>
              <Input id="start_datetime" type="datetime-local" {...register("start_datetime")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_datetime">End Date/Time</Label>
              <Input id="end_datetime" type="datetime-local" {...register("end_datetime")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Initial Status</Label>
            <Select
              id="status"
              options={[
                { value: "draft", label: "Draft" },
                { value: "open", label: "Open" },
                { value: "closed", label: "Closed" },
              ]}
              {...register("status")}
            />
          </div>

          {error ? <ActionAlert tone="error" message={error} /> : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Election"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/admin/ballot")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
