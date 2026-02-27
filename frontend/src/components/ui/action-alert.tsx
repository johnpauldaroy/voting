import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
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
  onClose?: () => void;
  closeLabel?: string;
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

export function ActionAlert({
  tone,
  title,
  message,
  className,
  autoHideMs = 2000,
  onAutoHide,
  onClose,
  closeLabel = "Close alert",
}: ActionAlertProps) {
  const config = toneConfig[tone];
  const Icon = config.icon;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
  }, [tone, title, message]);

  useEffect(() => {
    if (!autoHideMs || autoHideMs <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setVisible(false);
      onAutoHide?.();
    }, autoHideMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoHideMs, message, onAutoHide, title, tone]);

  if (!visible) {
    return null;
  }

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
        <button
          type="button"
          aria-label={closeLabel}
          className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-black/10"
          onClick={() => {
            setVisible(false);
            onClose?.();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
