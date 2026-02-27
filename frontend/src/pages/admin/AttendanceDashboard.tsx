import { useCallback, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { CalendarCheck2, Camera, UserCheck2, UserX, Users } from "lucide-react";
import { getAttendances, upsertAttendance } from "@/api/attendance";
import { extractErrorMessage } from "@/api/client";
import { getElections } from "@/api/elections";
import type { Attendance } from "@/api/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionAlert } from "@/components/ui/action-alert";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function parseVoterIdFromQr(rawValue: string): string | null {
  const normalized = rawValue
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ")
    .trim();

  if (normalized === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as Record<string, unknown>;
    const voterId = String(parsed?.voter_id ?? parsed?.voterId ?? "").trim();
    if (voterId !== "") {
      return voterId;
    }
  } catch {
    // Continue with alternate formats.
  }

  try {
    const url = new URL(normalized, window.location.origin);
    const voterId = (url.searchParams.get("voter_id") ?? url.searchParams.get("voterId") ?? "").trim();
    if (voterId !== "") {
      return voterId;
    }
  } catch {
    // Continue with raw query-string fallback.
  }

  const queryStart = normalized.indexOf("?");
  const queryString = queryStart >= 0 ? normalized.slice(queryStart) : normalized;
  const params = new URLSearchParams(queryString.startsWith("?") ? queryString : `?${queryString}`);
  const queryVoterId = (params.get("voter_id") ?? params.get("voterId") ?? "").trim();
  if (queryVoterId !== "") {
    return queryVoterId;
  }

  const inlineVoterId = normalized.match(/voter[_\s-]?id\s*[:=]\s*["']?([^"'\s,;|]+)["']?/i)?.[1]?.trim();
  if (inlineVoterId) {
    return inlineVoterId;
  }

  return null;
}

export function AttendanceDashboard() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0 });
  const [loading, setLoading] = useState(false);
  const [activeElectionId, setActiveElectionId] = useState<number | null>(null);
  const [activeElectionLabel, setActiveElectionLabel] = useState<string>("No election selected");
  const [notice, setNotice] = useState<{ tone: "error" | "success" | "warning"; message: string } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanHint, setScanHint] = useState("Allow camera access and point to voter QR code.");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const scanBusyRef = useRef(false);
  const lastScannedRef = useRef<{ voterId: string; at: number } | null>(null);

  const loadAttendances = useCallback(async (electionId: number) => {
    try {
      setLoading(true);
      const response = await getAttendances({
        election_id: electionId,
        per_page: 200,
      });
      setRecords(response.data);
      setSummary(response.summary);
    } catch (loadError) {
      setNotice({
        tone: "error",
        message: extractErrorMessage(loadError),
      });
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleScannedVoter = useCallback(
    async (voterId: string) => {
      if (!activeElectionId) {
        setNotice({
          tone: "error",
          message: "No election selected for attendance scanning.",
        });
        return;
      }

      try {
        const response = await upsertAttendance({
          election_id: activeElectionId,
          voter_id: voterId,
          status: "present",
        });

        setNotice({
          tone: "success",
          message: response.message,
        });
        setScanError(null);
        await loadAttendances(activeElectionId);
      } catch (scanSubmitError) {
        const message = extractErrorMessage(scanSubmitError);
        const lowerMessage = message.toLowerCase();
        setNotice({
          tone: lowerMessage.includes("already") && lowerMessage.includes("present") ? "warning" : "error",
          message,
        });
      }
    },
    [activeElectionId, loadAttendances]
  );

  useEffect(() => {
    void (async () => {
      try {
        const loadedElections = await getElections();

        if (loadedElections.length > 0) {
          const defaultElection =
            loadedElections.find((election) => election.status === "open") ?? loadedElections[0];
          setActiveElectionId(defaultElection.id);
          setActiveElectionLabel(`${defaultElection.title} (#${defaultElection.id})`);
          await loadAttendances(defaultElection.id);
        } else {
          setActiveElectionId(null);
          setActiveElectionLabel("No election selected");
        }
      } catch (loadError) {
        setNotice({
          tone: "error",
          message: extractErrorMessage(loadError),
        });
      }
    })();
  }, [loadAttendances]);

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

        const controls = await codeReader.decodeFromConstraints({ audio: false, video: videoConstraints }, videoRef.current, (result) => {
          if (cancelled || scanBusyRef.current) {
            return;
          }

          const raw = result?.getText()?.trim();
          if (!raw) {
            return;
          }

          const voterId = parseVoterIdFromQr(raw);
          if (!voterId) {
            setScanError("QR detected but voter ID was not found in the code.");
            return;
          }

          const now = Date.now();
          if (lastScannedRef.current && lastScannedRef.current.voterId === voterId && now - lastScannedRef.current.at < 2000) {
            return;
          }

          lastScannedRef.current = { voterId, at: now };
          scanBusyRef.current = true;
          setScanHint("Validating voter attendance...");

          void handleScannedVoter(voterId).finally(() => {
            scanBusyRef.current = false;
            setScanHint("Scanning QR code...");
          });
        });

        if (cancelled) {
          controls.stop();
          return;
        }

        zxingControlsRef.current = controls;
      } catch (scanInitError) {
        const message = scanInitError instanceof Error ? scanInitError.message.toLowerCase() : "";
        if (message.includes("permission") || message.includes("notallowed")) {
          setScanError("Camera permission was denied. Allow camera access, then try again.");
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
  }, [handleScannedVoter, scanOpen, stopScanner]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5" />
            Attendance Dashboard
          </CardTitle>
          <CardDescription>Overview of attendance activity and participation trends.</CardDescription>
        </CardHeader>
      </Card>

      {notice ? (
        <ActionAlert
          tone={notice.tone}
          message={notice.message}
          autoHideMs={3000}
          onAutoHide={() => setNotice(null)}
          onClose={() => setNotice(null)}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-xl font-bold text-foreground">{summary.total}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Present</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-muted-foreground">
            <UserCheck2 className="h-4 w-4" />
            <span className="text-xl font-bold text-foreground">{summary.present}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Absent</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-muted-foreground">
            <UserX className="h-4 w-4" />
            <span className="text-xl font-bold text-foreground">{summary.absent}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3 md:flex md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>Recent Attendance</CardTitle>
            <CardDescription>Attendance records for the selected election: {activeElectionLabel}.</CardDescription>
          </div>
          <Button
            type="button"
            className="inline-flex items-center gap-2"
            disabled={!activeElectionId}
            onClick={() => {
              setScanOpen(true);
              setScanError(null);
              setScanHint("Allow camera access and point to voter QR code.");
            }}
          >
            <Camera className="h-4 w-4" />
            Open Attendance Scanner
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voter ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Attendance Status</TableHead>
                <TableHead>Already Voted</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && records.length === 0
                ? Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`attendance-skeleton-${index}`}>
                      <TableCell>
                        <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-40 animate-pulse rounded bg-secondary" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-28 animate-pulse rounded bg-secondary" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
                      </TableCell>
                      <TableCell>
                        <div className="h-6 w-20 animate-pulse rounded-full bg-secondary" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-10 animate-pulse rounded bg-secondary" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-16 animate-pulse rounded bg-secondary" />
                      </TableCell>
                    </TableRow>
                  ))
                : records.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.user?.voter_id ?? "-"}</TableCell>
                  <TableCell>{row.user?.name ?? "-"}</TableCell>
                  <TableCell>{row.user?.branch ?? "-"}</TableCell>
                  <TableCell>{row.checked_in_at ? new Date(row.checked_in_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>
                    {row.status === "present" ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Present</Badge>
                    ) : (
                      <Badge variant="secondary">Absent</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.user?.already_voted ? (
                      <span className="font-bold text-green-600">YES</span>
                    ) : (
                      <span className="text-muted-foreground">NO</span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{row.source}</TableCell>
                </TableRow>
                  ))}
              {!loading && records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No attendance records found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
              Attendance Scanner
            </AlertDialogTitle>
            <AlertDialogDescription>{scanHint}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border bg-black/90">
              <video ref={videoRef} className="h-56 w-full object-cover" autoPlay muted playsInline />
            </div>
            {scanError ? <p className="text-sm text-destructive">{scanError}</p> : null}
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
    </div>
  );
}
