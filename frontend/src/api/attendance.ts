import { api } from "@/api/client";
import type { Attendance, AttendanceStatus, PaginationMeta } from "@/api/types";

interface GetAttendancesResponse {
  data: Attendance[];
  meta: PaginationMeta;
  summary: {
    total: number;
    present: number;
    absent: number;
  };
}

interface GetAttendancesParams {
  election_id?: number;
  search?: string;
  status?: AttendanceStatus;
  branch?: string;
  page?: number;
  per_page?: number;
}

interface GetAttendancesOptions {
  force?: boolean;
}

interface UpsertAttendancePayload {
  election_id: number;
  voter_id: string;
  status: AttendanceStatus;
  checked_in_at?: string | null;
}

interface UpsertAttendanceResponse {
  message: string;
  data: Attendance;
}

interface DeleteAttendanceResponse {
  message: string;
  data: Attendance;
}

interface DeleteAttendancesForElectionResponse {
  message: string;
  meta: {
    deleted: number;
    affected_voters: number;
  };
}

interface ImportAttendanceResponse {
  message: string;
  meta: {
    created: number;
    updated: number;
    total_processed: number;
    skipped?: number;
  };
  errors?: Array<{ line: number; message: string }>;
}

interface AttendanceAccessCheckInPayload {
  election_id: number;
  voter_id: string;
  voter_key: string;
}

export interface AttendanceAccessCheckInResponse {
  message: string;
  data: {
    voter: {
      name: string;
      branch: string | null;
      voter_id: string | null;
      is_active: boolean;
      attendance_status: AttendanceStatus;
    };
    election: {
      id: number;
      title: string;
      status: "draft" | "open" | "closed";
      start_datetime: string;
      end_datetime: string;
    };
    already_present: boolean;
    marked_present: boolean;
    marked_at: string | null;
  };
}

const ATTENDANCES_CACHE_TTL_MS = 10_000;

const attendancesCache = new Map<string, { data: GetAttendancesResponse; expiresAt: number }>();
const attendancesInFlightRequests = new Map<string, Promise<GetAttendancesResponse>>();
let attendancesCacheVersion = 0;

function normalizedAttendancesParams(params: GetAttendancesParams) {
  return {
    election_id: typeof params.election_id === "number" ? params.election_id : null,
    search: (params.search ?? "").trim(),
    branch: (params.branch ?? "").trim(),
    status: params.status ?? "all",
    page: params.page ?? 1,
    per_page: params.per_page ?? 25,
  };
}

function attendancesCacheKey(params: GetAttendancesParams) {
  const normalized = normalizedAttendancesParams(params);
  return `e:${normalized.election_id ?? "none"}|q:${normalized.search}|b:${normalized.branch}|s:${normalized.status}|p:${normalized.page}|pp:${normalized.per_page}`;
}

export function clearAttendancesCache(electionId?: number) {
  attendancesCacheVersion += 1;

  if (typeof electionId !== "number") {
    attendancesCache.clear();
    attendancesInFlightRequests.clear();
    return;
  }

  const prefix = `e:${electionId}|`;
  for (const key of [...attendancesCache.keys()]) {
    if (key.startsWith(prefix)) {
      attendancesCache.delete(key);
    }
  }

  for (const key of [...attendancesInFlightRequests.keys()]) {
    if (key.startsWith(prefix)) {
      attendancesInFlightRequests.delete(key);
    }
  }
}

export async function getAttendances(params: GetAttendancesParams, options: GetAttendancesOptions = {}) {
  const key = attendancesCacheKey(params);
  const now = Date.now();
  const shouldForce = options.force === true;

  if (!shouldForce) {
    const cached = attendancesCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const existingRequest = attendancesInFlightRequests.get(key);
    if (existingRequest) {
      return existingRequest;
    }
  }

  const normalized = normalizedAttendancesParams(params);
  const cacheVersionAtRequest = attendancesCacheVersion;
  const request = api.get<GetAttendancesResponse>("/attendances", {
    params: {
      election_id: normalized.election_id ?? undefined,
      search: normalized.search || undefined,
      branch: normalized.branch || undefined,
      status: normalized.status === "all" ? undefined : normalized.status,
      page: normalized.page,
      per_page: normalized.per_page,
    },
  })
    .then((response) => {
      const payload = response.data;
      if (cacheVersionAtRequest === attendancesCacheVersion) {
        attendancesCache.set(key, {
          data: payload,
          expiresAt: Date.now() + ATTENDANCES_CACHE_TTL_MS,
        });
      }
      return payload;
    })
    .finally(() => {
      if (attendancesInFlightRequests.get(key) === request) {
        attendancesInFlightRequests.delete(key);
      }
    });

  attendancesInFlightRequests.set(key, request);
  return request;
}

export async function upsertAttendance(payload: UpsertAttendancePayload) {
  const response = await api.post<UpsertAttendanceResponse>("/attendances", payload);
  clearAttendancesCache(payload.election_id);
  return response.data;
}

export async function deleteAttendance(userId: number, electionId: number) {
  const response = await api.delete<DeleteAttendanceResponse>(`/attendances/${userId}`, {
    params: {
      election_id: electionId,
    },
  });

  clearAttendancesCache(electionId);
  return response.data;
}

export async function deleteAttendancesForElection(electionId: number, confirmation: string) {
  const response = await api.delete<DeleteAttendancesForElectionResponse>("/attendances", {
    params: {
      election_id: electionId,
      confirmation,
    },
  });

  clearAttendancesCache(electionId);
  return response.data;
}

export async function importAttendances(file: File, electionId?: number) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("continue_on_error", "1");
  if (typeof electionId === "number") {
    formData.append("election_id", String(electionId));
  }

  const response = await api.post<ImportAttendanceResponse>("/attendances/import", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  clearAttendancesCache(electionId);
  return response.data;
}

export async function attendanceAccessCheckIn(payload: AttendanceAccessCheckInPayload) {
  const response = await api.post<AttendanceAccessCheckInResponse>("/attendance-access/check-in", payload);
  clearAttendancesCache(payload.election_id);
  return response.data;
}

function escapeCsvValue(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function downloadCsvBlob(blobData: BlobPart, fileName: string) {
  const blob = new Blob([blobData], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportPresentAttendancesCsv(electionId?: number) {
  const keepPresentRows = (rows: Attendance[]) => rows.filter((row) => row.status === "present");

  const firstPage = await getAttendances({
    election_id: electionId,
    status: "present",
    page: 1,
    per_page: 200,
  });

  const allRows: Attendance[] = [...keepPresentRows(firstPage.data)];
  for (let page = 2; page <= firstPage.meta.last_page; page += 1) {
    const nextPage = await getAttendances({
      election_id: electionId,
      status: "present",
      page,
      per_page: 200,
    });
    allRows.push(...keepPresentRows(nextPage.data));
  }

  const header = ["Name", "Branch", "Voter ID"];
  const body = allRows.map((row) => [
    row.user?.name ?? "",
    row.user?.branch ?? "",
    row.user?.voter_id ?? "",
  ]);

  const csv = [header, ...body]
    .map((line) => line.map((value) => escapeCsvValue(value)).join(","))
    .join("\r\n");

  downloadCsvBlob(csv, electionId ? `attendance_present_election_${electionId}.csv` : "attendance_present.csv");

  return allRows.length;
}
