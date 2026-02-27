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
  page?: number;
  per_page?: number;
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

interface ImportAttendanceResponse {
  message: string;
  meta: {
    created: number;
    updated: number;
    total_processed: number;
  };
}

export async function getAttendances(params: GetAttendancesParams) {
  const response = await api.get<GetAttendancesResponse>("/attendances", {
    params: {
      election_id: params.election_id,
      search: params.search || undefined,
      status: params.status,
      page: params.page ?? 1,
      per_page: params.per_page ?? 25,
    },
  });

  return response.data;
}

export async function upsertAttendance(payload: UpsertAttendancePayload) {
  const response = await api.post<UpsertAttendanceResponse>("/attendances", payload);
  return response.data;
}

export async function importAttendances(file: File, electionId?: number) {
  const formData = new FormData();
  formData.append("file", file);
  if (typeof electionId === "number") {
    formData.append("election_id", String(electionId));
  }

  const response = await api.post<ImportAttendanceResponse>("/attendances/import", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
}
