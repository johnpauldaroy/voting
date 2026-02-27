import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, KeyRound, QrCode, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { IScannerControls } from "@zxing/browser";
import { previewVoterAccess, type VoterAccessPreviewResponse } from "@/api/auth";
import { getElection } from "@/api/elections";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const accessSchema = z.object({
  voter_id: z.string().trim().min(1, "Voter ID is required."),
  voter_key: z.string().trim().min(1, "Voter key is required."),
  remember: z.boolean().optional(),
});

type AccessFormData = z.infer<typeof accessSchema>;

const BALLOT_CACHE_PRIME_WAIT_MS = 800;

function waitFor(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function extractVoterCredentials(payload: Record<string, unknown>): { voter_id: string; voter_key: string } | null {
  const voterId = String(payload.voter_id ?? payload.voterId ?? payload["voter-id"] ?? "").trim();
  const voterKey = String(payload.voter_key ?? payload.voterKey ?? payload["voter-key"] ?? "").trim();

  if (voterId === "" || voterKey === "") {
    return null;
  }

  return {
    voter_id: voterId,
    voter_key: voterKey,
  };
}

function normalizeQrInput(rawValue: string): string {
  let normalized = rawValue
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ")
    .trim();

  if (
    (normalized.startsWith("'") && normalized.endsWith("'")) ||
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("`") && normalized.endsWith("`"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
}

function parseVoterQrPayload(rawValue: string): { voter_id: string; voter_key: string } | null {
  const raw = normalizeQrInput(rawValue);
  if (raw === "") {
    return null;
  }

  const tryParseJson = (input: string): { voter_id: string; voter_key: string } | null => {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return extractVoterCredentials(parsed as Record<string, unknown>);
      }
    } catch {
      // Continue with alternate formats.
    }

    return null;
  };

  const fromJson = tryParseJson(raw);
  if (fromJson) {
    return fromJson;
  }

  const singleQuotedJson = raw
    .replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":')
    .replace(/:\s*'([^']*?)'(\s*[,}])/g, ':"$1"$2');
  const fromSingleQuotedJson = tryParseJson(singleQuotedJson);
  if (fromSingleQuotedJson) {
    return fromSingleQuotedJson;
  }

  try {
    const url = new URL(raw, window.location.origin);
    const voterId = (url.searchParams.get("voter_id") ?? url.searchParams.get("voterId") ?? "").trim();
    const voterKey = (url.searchParams.get("voter_key") ?? url.searchParams.get("voterKey") ?? "").trim();

    if (voterId !== "" && voterKey !== "") {
      return {
        voter_id: voterId,
        voter_key: voterKey,
      };
    }
  } catch {
    // Continue parsing with query string/plain formats.
  }

  const queryStart = raw.indexOf("?");
  const queryString = queryStart >= 0 ? raw.slice(queryStart) : raw;
  const normalizedQuery = queryString.startsWith("?") ? queryString : `?${queryString}`;
  const params = new URLSearchParams(normalizedQuery);
  const queryVoterId = (params.get("voter_id") ?? params.get("voterId") ?? "").trim();
  const queryVoterKey = (params.get("voter_key") ?? params.get("voterKey") ?? "").trim();

  if (queryVoterId !== "" && queryVoterKey !== "") {
    return {
      voter_id: queryVoterId,
      voter_key: queryVoterKey,
    };
  }

  const keyedVoterId = raw.match(/voter[_\s-]?id\s*[:=]\s*["']?([^"'\s,;|]+)["']?/i)?.[1]?.trim() ?? "";
  const keyedVoterKey = raw.match(/voter[_\s-]?key\s*[:=]\s*["']?([^"'\s,;|]+)["']?/i)?.[1]?.trim() ?? "";

  if (keyedVoterId !== "" && keyedVoterKey !== "") {
    return {
      voter_id: keyedVoterId,
      voter_key: keyedVoterKey,
    };
  }

  const pairMatch = raw.match(/^([^|:,;\s]+)\s*[|:,;]\s*([^|:,;\s]+)$/);
  if (pairMatch) {
    return {
      voter_id: pairMatch[1].trim(),
      voter_key: pairMatch[2].trim(),
    };
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 2) {
    return {
      voter_id: lines[0],
      voter_key: lines[1],
    };
  }

  return null;
}

export function VoterAccessPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const electionId = Number(params.id);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanHint, setScanHint] = useState<string>("Allow camera access and point to voter QR code.");
  const [scanPreview, setScanPreview] = useState<
    (VoterAccessPreviewResponse & { voter_key: string }) | null
  >(null);
  const [previewingScan, setPreviewingScan] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const scanHandledRef = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AccessFormData>({
    resolver: zodResolver(accessSchema),
    defaultValues: {
      voter_id: "",
      voter_key: "",
      remember: false,
    },
  });

  const stopScanner = useCallback(() => {
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
        // Ignore stop errors during cleanup.
      }
      zxingControlsRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const loginWithCredentials = useCallback(
    async (voterId: string, voterKey: string, remember: boolean) => {
      if (Number.isNaN(electionId)) {
        setError("Election access link is invalid.");
        return;
      }

      try {
        setSubmitting(true);
        setError(null);

        await login({
          login_type: "voter",
          voter_id: voterId.trim(),
          voter_key: voterKey.trim(),
          election_id: electionId,
          remember,
        });

        const warmBallotPromise = getElection(electionId)
          .then((election) => {
            sessionStorage.setItem(
              `assemblyvote_ballot_${electionId}`,
              JSON.stringify({
                cached_at: Date.now(),
                data: election,
              })
            );
          })
          .catch(() => {
            // Voting page will fetch directly if warm cache fails.
          });

        await Promise.race([warmBallotPromise, waitFor(BALLOT_CACHE_PRIME_WAIT_MS)]);

        navigate(`/voting/${electionId}`, { replace: true });
      } catch (authError) {
        if (authError instanceof Error) {
          setError(authError.message);
        } else {
          setError("Unable to sign in with voter credentials.");
        }
        setManualMode(true);
      } finally {
        setSubmitting(false);
      }
    },
    [electionId, login, navigate]
  );

  useEffect(() => {
    setScanOpen(true);
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  useEffect(() => {
    let cancelled = false;
    scanHandledRef.current = false;

    if (!scanOpen) {
      stopScanner();
      return;
    }

    const startScanner = async () => {
      setScanError(null);
      setScanHint("Allow camera access and point to voter QR code.");

      if (!navigator.mediaDevices?.getUserMedia) {
        setScanError("Camera is not available in this browser.");
        return;
      }

      if (!videoRef.current) {
        window.setTimeout(() => {
          if (!cancelled) {
            void startScanner();
          }
        }, 16);
        return;
      }

      try {
        const { BrowserCodeReader, BrowserQRCodeReader } = await import("@zxing/browser");

        if (cancelled || !videoRef.current) {
          return;
        }

        const devices = await BrowserCodeReader.listVideoInputDevices();
        const preferredDevice =
          devices.find((device) => /(back|rear|environment)/i.test(device.label)) ?? devices[0] ?? null;

        const videoConstraints = preferredDevice
          ? {
              deviceId: { exact: preferredDevice.deviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30, max: 60 },
            }
          : {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30, max: 60 },
            };

        const codeReader = new BrowserQRCodeReader();
        setScanHint("Scanning QR code...");
        setScanError(null);

        const controls = await codeReader.decodeFromConstraints({ audio: false, video: videoConstraints }, videoRef.current, (result) => {
            if (cancelled) {
              return;
            }

            if (scanHandledRef.current) {
              return;
            }

            const raw = result?.getText()?.trim();

            if (!raw) {
              return;
            }

            const parsed = parseVoterQrPayload(raw);
            if (!parsed) {
              setScanError("QR detected but format is invalid. Keep the code steady and try again.");
              return;
            }

            scanHandledRef.current = true;
            stopScanner();
            setScanHint("QR detected. Loading voter information...");
            setScanError(null);
            setPreviewingScan(true);

            void (async () => {
              try {
                const preview = await previewVoterAccess({
                  election_id: electionId,
                  voter_id: parsed.voter_id,
                  voter_key: parsed.voter_key,
                });

                setValue("voter_id", parsed.voter_id, { shouldValidate: true, shouldDirty: true });
                setValue("voter_key", parsed.voter_key, { shouldValidate: true, shouldDirty: true });
                setScanOpen(false);
                setScanPreview({
                  ...preview,
                  voter_key: parsed.voter_key,
                });
              } catch (previewError) {
                scanHandledRef.current = false;
                setScanError(previewError instanceof Error ? previewError.message : "Unable to validate scanned QR.");
                setManualMode(true);
              } finally {
                setPreviewingScan(false);
              }
            })();
          });

        if (cancelled) {
          controls.stop();
          return;
        }

        zxingControlsRef.current = controls;
      } catch (scanInitError) {
        const message = scanInitError instanceof Error ? scanInitError.message.toLowerCase() : "";
        if (message.includes("permission") || message.includes("notallowed")) {
          setScanError("Camera permission was denied. Allow camera access, then try scanning again.");
        } else {
          setScanError("Unable to initialize QR scanner. Check camera permission and use HTTPS or localhost.");
        }
        setManualMode(true);
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [electionId, loginWithCredentials, scanOpen, setValue, stopScanner]);

  const onSubmit = async (values: AccessFormData) => {
    await loginWithCredentials(values.voter_id, values.voter_key, Boolean(values.remember));
  };

  const canProceedFromPreview = Boolean(scanPreview?.can_proceed);

  const electionAccessRemark = (() => {
    if (!scanPreview) {
      return {
        message: "",
        className: "border-blue-300 bg-blue-50 text-blue-800",
      };
    }

    if (scanPreview.election.status !== "open") {
      return {
        message: scanPreview.reason ?? "Election is not currently open for voting.",
        className: "border-amber-300 bg-amber-50 text-amber-800",
      };
    }

    if (!scanPreview.voter.is_active) {
      return {
        message: scanPreview.reason ?? "Voter account is inactive.",
        className: "border-amber-300 bg-amber-50 text-amber-800",
      };
    }

    if (scanPreview.can_proceed) {
      return {
        message: "Election is open. Voter can proceed.",
        className: "border-blue-300 bg-blue-50 text-blue-800",
      };
    }

    if (!scanPreview.voter.has_voted && scanPreview.reason) {
      return {
        message: scanPreview.reason,
        className: "border-amber-300 bg-amber-50 text-amber-800",
      };
    }

    return {
      message: "Election is open for voting.",
      className: "border-blue-300 bg-blue-50 text-blue-800",
    };
  })();

  return (
    <div className="mx-auto w-full max-w-md animate-fade-up space-y-4">
      <div className="space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Voter Access</h2>
        <p className="text-sm text-muted-foreground">Scan QR first for faster login. Use manual login only if needed.</p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <QrCode className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Scan QR (Recommended)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use your voter QR code for instant ballot access.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => setScanOpen(true)}
            disabled={submitting}
            className="h-11 min-w-[190px] px-6 font-semibold shadow-md shadow-primary/20"
          >
            <Camera className="mr-2 h-4 w-4" />
            {scanOpen ? "Scanner Active" : "Open Scanner"}
          </Button>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
              scanOpen ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
            }`}
          >
            {scanOpen ? "Camera is running" : "Tap to scan voter QR"}
          </span>
        </div>

        {scanError ? <p className="mt-3 text-sm text-destructive">{scanError}</p> : null}

        <Button
          type="button"
          variant="ghost"
          className="mt-2 h-auto p-0 text-sm font-medium text-primary hover:bg-transparent hover:text-primary/90"
          onClick={() => setManualMode((current) => !current)}
        >
          {manualMode ? "Hide manual login" : "QR not working? Use Voter ID and Key"}
        </Button>
      </div>

      {manualMode ? (
        <form className="space-y-4 rounded-xl border bg-card p-4" onSubmit={handleSubmit((values) => void onSubmit(values))}>
          <div className="space-y-2">
            <Label htmlFor="voter_id">Voter ID</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="voter_id" className="pl-9" autoComplete="username" {...register("voter_id")} />
            </div>
            {errors.voter_id ? <p className="text-sm text-destructive">{errors.voter_id.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="voter_key">Voter Key</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="voter_key"
                type="password"
                className="pl-9"
                autoComplete="current-password"
                {...register("voter_key")}
              />
            </div>
            {errors.voter_key ? <p className="text-sm text-destructive">{errors.voter_key.message}</p> : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="h-4 w-4 rounded border-input" {...register("remember")} />
            Remember me
          </label>

          <Button disabled={submitting} type="submit" className="w-full">
            {submitting ? "Signing in..." : "Access Ballot"}
          </Button>
        </form>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <AlertDialog
        open={Boolean(scanPreview)}
        onOpenChange={(open) => {
          if (!open) {
            setScanPreview(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Voter Information</AlertDialogTitle>
            <AlertDialogDescription>
              Review the scanned voter details before proceeding to ballot access.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {scanPreview ? (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Voter Name</p>
                <p className="font-semibold text-foreground">{scanPreview.voter.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Branch</p>
                  <p className="font-medium text-foreground">{scanPreview.voter.branch ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Voter ID</p>
                  <p className="font-medium text-foreground">{scanPreview.voter.voter_id ?? "-"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Election</p>
                <p className="font-medium text-foreground">{scanPreview.election.title}</p>
              </div>
              <p
                className={`rounded-md border px-3 py-2 text-xs ${
                  scanPreview.voter.has_voted
                    ? "border-rose-300 bg-rose-50 text-rose-800"
                    : "border-emerald-300 bg-emerald-50 text-emerald-800"
                }`}
              >
                {scanPreview.voter.has_voted
                  ? "This voter has already cast their vote."
                  : "This voter has not yet cast their vote."}
              </p>
              <p
                className={`rounded-md border px-3 py-2 text-xs ${electionAccessRemark.className}`}
              >
                {electionAccessRemark.message}
              </p>
            </div>
          ) : null}

          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setScanPreview(null);
                setScanOpen(true);
                setScanError(null);
              }}
            >
              Rescan
            </Button>
            <Button
              type="button"
              disabled={!scanPreview || !canProceedFromPreview || previewingScan || submitting}
              onClick={() => {
                if (!scanPreview?.voter.voter_id) {
                  setError("Scanned voter ID is missing.");
                  return;
                }

                const voterId = scanPreview.voter.voter_id;
                const voterKey = scanPreview.voter_key;
                setScanPreview(null);
                void loginWithCredentials(voterId, voterKey, false);
              }}
            >
              {submitting ? "Proceeding..." : "Confirm and Proceed"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={scanOpen}
        onOpenChange={(open) => {
          setScanOpen(open);
          if (!open) {
            stopScanner();
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="inline-flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Scan Voter QR
            </AlertDialogTitle>
            <AlertDialogDescription>{scanHint}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border bg-black/90">
              <video ref={videoRef} className="h-56 w-full object-cover" autoPlay muted playsInline />
            </div>

            {previewingScan ? <p className="text-sm text-muted-foreground">Validating scanned voter...</p> : null}
            {scanError ? <p className="text-sm text-destructive">{scanError}</p> : null}
          </div>

          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setManualMode(true);
                setScanOpen(false);
              }}
            >
              Use Manual Login
            </Button>
            <AlertDialogCancel
              onClick={() => {
                setScanOpen(false);
              }}
            >
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
