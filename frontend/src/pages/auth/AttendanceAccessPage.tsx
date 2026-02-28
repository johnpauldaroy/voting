import { useCallback, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Camera, Link as LinkIcon, QrCode } from "lucide-react";
import { useParams } from "react-router-dom";
import { attendanceAccessCheckIn, type AttendanceAccessCheckInResponse } from "@/api/attendance";
import { extractErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

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

interface ScanValidation {
  tone: "success" | "warning" | "error";
  message: string;
  voterId: string | null;
  data?: AttendanceAccessCheckInResponse["data"];
  at: number;
}

export function AttendanceAccessPage() {
  const params = useParams();
  const electionId = Number(params.id);

  const [submitting, setSubmitting] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanHint, setScanHint] = useState("Allow camera access and point to voter QR code.");
  const [scanValidation, setScanValidation] = useState<ScanValidation | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const scanBusyRef = useRef(false);
  const lastScannedRef = useRef<{ voterId: string; at: number } | null>(null);

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

  const markAttendance = useCallback(async (voterId: string, voterKey: string) => {
    if (Number.isNaN(electionId)) {
      setScanValidation({
        tone: "error",
        message: "Attendance access link is invalid.",
        voterId: null,
        at: Date.now(),
      });
      return;
    }

    if (!voterId || !voterKey) {
      setScanValidation({
        tone: "error",
        message: "Both voter ID and voter key are required.",
        voterId: voterId || null,
        at: Date.now(),
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await attendanceAccessCheckIn({
        election_id: electionId,
        voter_id: voterId,
        voter_key: voterKey,
      });

      setScanValidation({
        tone: response.data.already_present ? "warning" : "success",
        message: response.message,
        voterId,
        data: response.data,
        at: Date.now(),
      });
      setScanError(null);
    } catch (checkInError) {
      setScanValidation({
        tone: "error",
        message: extractErrorMessage(checkInError),
        voterId: voterId || null,
        at: Date.now(),
      });
    } finally {
      setSubmitting(false);
    }
  }, [electionId]);

  const processScannedQrValue = useCallback(async (rawValue: string) => {
    if (scanBusyRef.current) {
      return;
    }

    const parsed = parseVoterQrPayload(rawValue);
    if (!parsed) {
      const message = "QR detected but voter credentials were not found in the code.";
      setScanError(message);
      setScanValidation({
        tone: "error",
        message,
        voterId: null,
        at: Date.now(),
      });
      return;
    }

    const now = Date.now();
    if (lastScannedRef.current && lastScannedRef.current.voterId === parsed.voter_id && now - lastScannedRef.current.at < 2000) {
      return;
    }

    lastScannedRef.current = { voterId: parsed.voter_id, at: now };
    scanBusyRef.current = true;
    setScanError(null);
    setScanHint("Marking attendance...");

    try {
      await markAttendance(parsed.voter_id, parsed.voter_key);
    } finally {
      scanBusyRef.current = false;
      setScanHint(scanOpen ? "Scanning QR code..." : "Allow camera access and point to voter QR code.");
    }
  }, [markAttendance, scanOpen]);

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
    scanBusyRef.current = false;

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

        const controls = await codeReader.decodeFromConstraints({ audio: false, video: videoConstraints }, videoRef.current, (decoded) => {
          if (cancelled || scanBusyRef.current) {
            return;
          }

          const raw = decoded?.getText()?.trim();
          if (!raw) {
            return;
          }

          void processScannedQrValue(raw);
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
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [processScannedQrValue, scanOpen, stopScanner]);

  return (
    <div className="mx-auto w-full max-w-md animate-fade-up space-y-4">
      <div className="space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Attendance Access</h2>
        <p className="text-sm text-muted-foreground">Scan voter QR to mark attendance as present.</p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <QrCode className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Scan QR (Recommended)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Each successful scan marks the voter as present immediately.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => {
              setScanOpen(true);
              setScanError(null);
              setScanHint("Allow camera access and point to voter QR code.");
              setScanValidation(null);
            }}
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

      </div>

      {scanValidation && !scanOpen ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            scanValidation.tone === "success" && "border-emerald-300 bg-emerald-50 text-emerald-800",
            scanValidation.tone === "warning" && "border-amber-300 bg-amber-50 text-amber-800",
            scanValidation.tone === "error" && "border-rose-300 bg-rose-50 text-rose-800"
          )}
        >
          <p className="font-semibold">{scanValidation.message}</p>
          <p className="mt-1 text-xs">
            {scanValidation.voterId ? `Voter ID: ${scanValidation.voterId} - ` : ""}
            {new Date(scanValidation.at).toLocaleTimeString()}
          </p>
        </div>
      ) : null}

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
              Scan Attendance QR
            </AlertDialogTitle>
            <AlertDialogDescription>{scanHint}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border bg-black/90">
              <video ref={videoRef} className="h-56 w-full object-cover" autoPlay muted playsInline />
            </div>
            {scanError ? <p className="text-sm text-destructive">{scanError}</p> : null}
            {scanValidation ? (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  scanValidation.tone === "success" && "border-emerald-300 bg-emerald-50 text-emerald-800",
                  scanValidation.tone === "warning" && "border-amber-300 bg-amber-50 text-amber-800",
                  scanValidation.tone === "error" && "border-rose-300 bg-rose-50 text-rose-800"
                )}
              >
                <p className="font-semibold">{scanValidation.message}</p>
                <p className="mt-1 text-xs">
                  {scanValidation.voterId ? `Voter ID: ${scanValidation.voterId} - ` : ""}
                  {new Date(scanValidation.at).toLocaleTimeString()}
                </p>
              </div>
            ) : null}
          </div>

          <AlertDialogFooter>
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

      <div className="flex items-center justify-center text-xs text-muted-foreground">
        <LinkIcon className="mr-1 h-3.5 w-3.5" />
        Attendance access for election #{Number.isNaN(electionId) ? "-" : electionId}
      </div>
    </div>
  );
}
