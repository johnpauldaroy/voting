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
  const firstPage = await getAttendances({
    election_id: electionId,
    status: "present",
    page: 1,
    per_page: 200,
  });

  const allRows: Attendance[] = [...firstPage.data];
  for (let page = 2; page <= firstPage.meta.last_page; page += 1) {
    const nextPage = await getAttendances({
      election_id: electionId,
      status: "present",
      page,
      per_page: 200,
    });
    allRows.push(...nextPage.data);
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
