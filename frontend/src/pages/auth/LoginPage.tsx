import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/api/types";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  remember: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LocationState {
  from?: {
    pathname?: string;
  };
}

function defaultPathForRole(role: UserRole): string {
  return role === "voter" ? "/elections/active" : "/admin";
}

function canAccessPath(role: UserRole, path: string): boolean {
  if (path === "" || path === "/" || path === "/login" || path === "/unauthorized") {
    return false;
  }

  if (role === "voter") {
    return (
      path === "/dashboard" ||
      path === "/elections/active" ||
      path.startsWith("/voting/") ||
      path.startsWith("/results/")
    );
  }

  if (role === "super_admin") {
    return path.startsWith("/admin");
  }

  if (role === "election_admin") {
    return path.startsWith("/admin") && !path.startsWith("/admin/audit-logs");
  }

  return false;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  const fromPath = useMemo(() => {
    const state = location.state as LocationState | null;
    return state?.from?.pathname;
  }, [location.state]);

  const onSubmit = async (values: LoginFormData) => {
    try {
      setSubmitting(true);
      const user = await login(values);
      const fallbackPath = defaultPathForRole(user.role);

      if (fromPath && canAccessPath(user.role, fromPath)) {
        navigate(fromPath, { replace: true });
        return;
      }

      navigate(fallbackPath, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md animate-fade-up">
      <div className="mb-6 space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Sign in</h2>
        <p className="text-sm text-muted-foreground">Access your representative voting workspace.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
          {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="h-4 w-4 rounded border-input" {...register("remember")} />
          Remember me
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </div>
  );
}
