import { useEffect } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ActionAlertTone = "error" | "warning" | "info" | "success";

interface ActionAlertProps {
  tone: ActionAlertTone;
  title?: string;
  message: string;
  className?: string;
  autoHideMs?: number;
  onAutoHide?: () => void;
}

const toneConfig: Record<
  ActionAlertTone,
  { icon: LucideIcon; title: string; className: string; titleClassName: string }
> = {
  error: {
    icon: AlertCircle,
    title: "Error",
    className: "bg-[#fb4b6e] text-white",
    titleClassName: "text-white",
  },
  warning: {
    icon: AlertTriangle,
    title: "Warning",
    className: "bg-[#ffbc34] text-[#11142d]",
    titleClassName: "text-[#11142d]",
  },
  info: {
    icon: Info,
    title: "Info",
    className: "bg-[#1f9de3] text-white",
    titleClassName: "text-white",
  },
  success: {
    icon: CheckCircle2,
    title: "Success",
    className: "bg-[#13bfa6] text-white",
    titleClassName: "text-white",
  },
};

export function ActionAlert({ tone, title, message, className, autoHideMs, onAutoHide }: ActionAlertProps) {
  const config = toneConfig[tone];
  const Icon = config.icon;

  useEffect(() => {
    if (!autoHideMs || autoHideMs <= 0 || !onAutoHide) {
      return;
    }

    const timer = window.setTimeout(() => {
      onAutoHide();
    }, autoHideMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoHideMs, message, onAutoHide, title, tone]);

  return (
    <div
      role="alert"
      className={cn(
        "animate-fade-in rounded-[10px] px-4 py-3 shadow-sm",
        config.className,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className={cn("text-lg font-bold leading-none", config.titleClassName)}>
            {title ?? config.title}
          </p>
          <p className="mt-2 text-sm font-semibold">{message}</p>
        </div>
      </div>
    </div>
  );
}
