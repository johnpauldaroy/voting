import { Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

interface InlineLoadingStateProps {
  label?: string;
  className?: string;
}

export function PageLoadingState({
  title = "Loading page",
  subtitle = "Preparing secure voting workspace...",
  className,
}: LoadingStateProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-6 shadow-card", className)}>
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-full bg-secondary">
          <span className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <ShieldCheck className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-primary" />
        </div>
        <div>
          <p className="text-base font-bold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
        <div className="h-3 w-full animate-pulse rounded bg-secondary" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-secondary" />
      </div>
    </div>
  );
}

export function InlineLoadingState({ label = "Loading...", className }: InlineLoadingStateProps) {
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span>{label}</span>
    </div>
  );
}

export function FullPageLoader({ title, subtitle, className }: LoadingStateProps) {
  return (
    <div className="min-h-screen app-shell-bg p-6">
      <div className="mx-auto mt-16 max-w-xl">
        <PageLoadingState title={title} subtitle={subtitle} className={className} />
      </div>
    </div>
  );
}
