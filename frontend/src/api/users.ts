import { api } from "@/api/client";
import type { PaginationMeta, User, UserRole } from "@/api/types";

interface GetVotersOptions {
  force?: boolean;
}

const VOTERS_CACHE_TTL_MS = 10_000;

const votersCache = new Map<string, { data: { data: User[]; meta: PaginationMeta }; expiresAt: number }>();
const votersInFlightRequests = new Map<string, Promise<{ data: User[]; meta: PaginationMeta }>>();
let votersCacheVersion = 0;

function normalizedVotersParams(page: number, perPage: number, search: string, electionId?: number, branch?: string) {
  return {
    page,
    per_page: perPage,
    search: search.trim(),
    election_id: typeof electionId === "number" ? electionId : null,
    branch: (branch ?? "").trim(),
  };
}

function votersCacheKey(page: number, perPage: number, search: string, electionId?: number, branch?: string) {
  const normalized = normalizedVotersParams(page, perPage, search, electionId, branch);
  return `p:${normalized.page}|pp:${normalized.per_page}|q:${normalized.search}|e:${normalized.election_id ?? "none"}|b:${normalized.branch}`;
}

export function clearVotersCache() {
  votersCacheVersion += 1;
  votersCache.clear();
  votersInFlightRequests.clear();
}

export async function getVoters(
  page = 1,
  perPage = 25,
  search = "",
  electionId?: number,
  branch?: string,
  options: GetVotersOptions = {}
) {
  const key = votersCacheKey(page, perPage, search, electionId, branch);
  const now = Date.now();
  const shouldForce = options.force === true;

  if (!shouldForce) {
    const cached = votersCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const existingRequest = votersInFlightRequests.get(key);
    if (existingRequest) {
      return existingRequest;
    }
  }

  const normalized = normalizedVotersParams(page, perPage, search, electionId, branch);
  const cacheVersionAtRequest = votersCacheVersion;
  const request = api.get<{ data: User[]; meta: PaginationMeta }>("/voters", {
    params: {
      page: normalized.page,
      per_page: normalized.per_page,
      search: normalized.search || undefined,
      election_id: normalized.election_id ?? undefined,
      branch: normalized.branch || undefined,
    },
  })
    .then((response) => {
      const payload = response.data;
      if (cacheVersionAtRequest === votersCacheVersion) {
        votersCache.set(key, {
          data: payload,
          expiresAt: Date.now() + VOTERS_CACHE_TTL_MS,
        });
      }
      return payload;
    })
    .finally(() => {
      if (votersInFlightRequests.get(key) === request) {
        votersInFlightRequests.delete(key);
      }
    });

  votersInFlightRequests.set(key, request);
  return request;
}

export async function updateVoterStatus(userId: number, isActive: boolean) {
  const response = await api.patch<{ data: User }>(`/voters/${userId}/status`, {
    is_active: isActive,
  });

  clearVotersCache();
  return response.data.data;
}

interface CreateVoterPayload {
  name: string;
  branch?: string | null;
  email?: string | null;
  voter_id: string;
  voter_key: string;
  is_active?: boolean;
}

export interface ManageUserPayload {
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  voter_id?: string | null;
  voter_key?: string | null;
  password?: string;
}

export async function getUsers(page = 1, perPage = 25, search = "", role?: UserRole) {
  const response = await api.get<{ data: User[]; meta: PaginationMeta }>("/users", {
    params: {
      page,
      per_page: perPage,
      search: search || undefined,
      role: role || undefined,
    },
  });

  return response.data;
}

export async function createUser(payload: ManageUserPayload) {
  const response = await api.post<{ data: User }>("/users", payload);
  return response.data.data;
}

export async function updateUser(userId: number, payload: ManageUserPayload) {
  const response = await api.patch<{ data: User }>(`/users/${userId}`, payload);
  return response.data.data;
}

export async function deleteUser(userId: number) {
  await api.delete(`/users/${userId}`);
}

export async function createVoter(payload: CreateVoterPayload) {
  const response = await api.post<{ data: User }>("/voters", payload);
  clearVotersCache();
  return response.data.data;
}

export async function updateVoter(userId: number, payload: CreateVoterPayload) {
  const response = await api.patch<{ data: User }>(`/voters/${userId}`, payload);
  clearVotersCache();
  return response.data.data;
}

export async function deleteVoter(userId: number) {
  await api.delete(`/voters/${userId}`);
  clearVotersCache();
}

export interface DeleteVotersResponse {
  message: string;
  data: {
    deleted: number;
    reassigned_elections: number;
    protected_accounts: string[];
  };
}

export async function deleteAllVotersExceptProtected(confirmation: string) {
  const response = await api.delete<DeleteVotersResponse>("/voters", {
    data: {
      confirmation,
    },
  });

  clearVotersCache();
  return response.data;
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

export async function exportVoters(search = "", electionId?: number, branch?: string) {
  const response = await api.get<Blob>("/voters/export", {
    params: {
      search: search || undefined,
      election_id: electionId,
      branch: branch || undefined,
    },
    responseType: "blob",
  });

  downloadCsvBlob(response.data, "voters.csv");
}

export async function exportVoterLogs(search = "", electionId?: number, branch?: string) {
  const response = await api.get<Blob>("/voters/logs/export", {
    params: {
      search: search || undefined,
      election_id: electionId,
      branch: branch || undefined,
    },
    responseType: "blob",
  });

  downloadCsvBlob(response.data, electionId ? `voter_logs_election_${electionId}.csv` : "voter_logs.csv");
}

export async function downloadVoterTemplate() {
  const response = await api.get<Blob>("/voters/template", {
    responseType: "blob",
  });

  downloadCsvBlob(response.data, "voter_import_template.csv");
}

export interface ImportVotersResponse {
  message: string;
  meta: {
    created: number;
    updated: number;
    total_processed: number;
    skipped?: number;
  };
  errors?: Array<{ line: number; message: string }>;
}

export interface VoterImportProgressSnapshot {
  status: "upload_received" | "validating" | "importing" | "completed" | "failed";
  percent: number;
  processed: number;
  total: number;
  created: number;
  updated: number;
  message: string;
  updated_at: string;
}

export async function getVoterImportProgress(importId: string) {
  const response = await api.get<{ data: VoterImportProgressSnapshot }>(`/voters/import/progress/${encodeURIComponent(importId)}`);
  return response.data.data;
}

export async function importVoters(file: File, importId: string, onProgress?: (percent: number) => void) {
  const formData = new FormData();
  formData.append("import_id", importId);
  formData.append("file", file);
  formData.append("continue_on_error", "1");

  const response = await api.post<ImportVotersResponse>("/voters/import", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (event) => {
      if (!onProgress) {
        return;
      }

      if (!event.total || event.total <= 0) {
        onProgress(0);
        return;
      }

      const percent = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
      onProgress(percent);
    },
  });

  clearVotersCache();
  onProgress?.(100);
  return response.data;
}
