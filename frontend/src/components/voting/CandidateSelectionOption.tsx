import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type OptionInputType = "radio" | "checkbox";

interface CandidateSelectionOptionProps {
  inputType: OptionInputType;
  inputName: string;
  checked: boolean;
  candidate: {
    id: number;
    name: string;
    bio: string | null;
    photo_path: string | null;
  };
  onChange: () => void;
  resolveImage: (photoPath: string | null) => string | null;
  fallbackImage: string;
}

export function CandidateSelectionOption({
  inputType,
  inputName,
  checked,
  candidate,
  onChange,
  resolveImage,
  fallbackImage,
}: CandidateSelectionOptionProps) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary/45 hover:bg-primary/5 hover:shadow-card",
        checked ? "border-primary/70 bg-primary/5 shadow-card" : "border-border"
      )}
    >
      <input type={inputType} name={inputName} checked={checked} onChange={onChange} className="peer sr-only" />

      <span
        className={cn(
          "mt-3 flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-all duration-200",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-primary/60 peer-focus-visible:ring-offset-2",
          inputType === "radio" ? "rounded-full" : "rounded-[6px]",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-transparent"
        )}
      >
        {inputType === "radio" ? (
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full bg-primary-foreground transition-all duration-150",
              checked ? "scale-100 opacity-100" : "scale-0 opacity-0"
            )}
          />
        ) : (
          <Check
            className={cn(
              "h-3.5 w-3.5 transition-all duration-150",
              checked ? "scale-100 opacity-100" : "scale-75 opacity-0"
            )}
          />
        )}
      </span>

      <img
        src={resolveImage(candidate.photo_path) ?? fallbackImage}
        alt={`${candidate.name} profile`}
        className={cn(
          "h-12 w-12 rounded-full border object-cover transition-all duration-200",
          checked ? "border-primary/40 ring-2 ring-primary/20" : "border-border"
        )}
        onError={(event) => {
          event.currentTarget.src = fallbackImage;
        }}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Label className={cn("cursor-pointer font-semibold", checked ? "text-primary" : "text-foreground")}>
            {candidate.name}
          </Label>
          {checked ? (
            <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Selected
            </span>
          ) : null}
        </div>
        <p className="text-sm whitespace-pre-line text-muted-foreground [overflow-wrap:anywhere]">
          {candidate.bio ?? "No bio provided."}
        </p>
      </div>
    </label>
  );
}
