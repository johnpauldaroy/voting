import { createContext, useCallback, useMemo, useRef, useState } from "react";
import { extractErrorMessage } from "@/api/client";
import { importAttendances } from "@/api/attendance";

export type AttendanceImportStatus = "idle" | "uploading" | "processing" | "success" | "error";

type AttendanceImportResponse = Awaited<ReturnType<typeof importAttendances>>;

interface AttendanceImportState {
  status: AttendanceImportStatus;
  progress: number;
  fileName: string | null;
  message: string | null;
  meta: AttendanceImportResponse["meta"] | null;
}

interface AttendanceImportContextValue extends AttendanceImportState {
  isImporting: boolean;
  startImport: (file: File, electionId?: number) => Promise<AttendanceImportResponse>;
  clearState: () => void;
}

const DEFAULT_STATE: AttendanceImportState = {
  status: "idle",
  progress: 0,
  fileName: null,
  message: null,
  meta: null,
};

export const AttendanceImportContext = createContext<AttendanceImportContextValue | undefined>(undefined);

export function AttendanceImportProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AttendanceImportState>(DEFAULT_STATE);
  const activeImportPromise = useRef<Promise<AttendanceImportResponse> | null>(null);

  const clearState = useCallback(() => {
    setState((current) => {
      if (current.status === "uploading" || current.status === "processing") {
        return current;
      }

      return DEFAULT_STATE;
    });
  }, []);

  const startImport = useCallback(async (file: File, electionId?: number) => {
    if (activeImportPromise.current) {
      throw new Error("An attendance import is already in progress.");
    }

    setState({
      status: "uploading",
      progress: 0,
      fileName: file.name,
      message: null,
      meta: null,
    });

    const task = importAttendances(file, electionId, {
      onUploadProgress: (percent) => {
        setState((current) => ({
          ...current,
          progress: percent,
          status: percent >= 100 ? "processing" : "uploading",
          message: percent >= 100 ? "Upload complete. Waiting for import processing..." : current.message,
        }));
      },
    });

    activeImportPromise.current = task;

    try {
      const response = await task;
      const skipped = response.meta.skipped ?? 0;
      const processed = response.meta.total_processed ?? 0;
      const updated = response.meta.updated ?? 0;

      setState({
        status: "success",
        progress: 100,
        fileName: file.name,
        message:
          skipped > 0
            ? `${response.message} Updated: ${updated}, processed: ${processed}, skipped: ${skipped}.`
            : `${response.message} Updated: ${updated}, processed: ${processed}.`,
        meta: response.meta,
      });

      return response;
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        message: extractErrorMessage(error),
        meta: null,
      }));
      throw error;
    } finally {
      activeImportPromise.current = null;
    }
  }, []);

  const value = useMemo<AttendanceImportContextValue>(
    () => ({
      ...state,
      isImporting: state.status === "uploading" || state.status === "processing",
      startImport,
      clearState,
    }),
    [state, startImport, clearState]
  );

  return <AttendanceImportContext.Provider value={value}>{children}</AttendanceImportContext.Provider>;
}
