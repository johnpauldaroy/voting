import { api } from "@/api/client";
import type { Candidate, Election, ElectionStatus, Position } from "@/api/types";

const electionInFlightRequests = new Map<number, Promise<Election>>();
const electionListInFlightRequests = new Map<string, Promise<Election[]>>();
const electionListCache = new Map<string, { data: Election[]; expiresAt: number }>();
const ELECTION_LIST_CACHE_TTL_MS = 10_000;
let electionListCacheVersion = 0;

interface ElectionPayload {
  title: string;
  description?: string | null;
  start_datetime: string;
  end_datetime: string;
  status?: ElectionStatus;
}

interface PositionPayload {
  title: string;
  min_votes_allowed?: number;
  max_votes_allowed?: number;
}

interface CandidatePayload {
  position_id: number;
  name: string;
  photo?: File | null;
  bio?: string | null;
}

interface CandidateUpdatePayload {
  position_id?: number;
  name?: string;
  photo?: File | null;
  bio?: string | null;
}

interface GetElectionsOptions {
  force?: boolean;
}

function electionListCacheKey(status?: ElectionStatus) {
  return status ?? "all";
}

export function clearElectionsCache(status?: ElectionStatus) {
  electionListCacheVersion += 1;

  if (typeof status === "string") {
    const key = electionListCacheKey(status);
    electionListCache.delete(key);
    electionListInFlightRequests.delete(key);
    return;
  }

  electionListCache.clear();
  electionListInFlightRequests.clear();
}

export async function getElections(status?: ElectionStatus, options: GetElectionsOptions = {}) {
  const key = electionListCacheKey(status);
  const now = Date.now();
  const shouldForce = options.force === true;

  if (!shouldForce) {
    const cached = electionListCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const existingRequest = electionListInFlightRequests.get(key);
    if (existingRequest) {
      return existingRequest;
    }
  }

  const cacheVersionAtRequest = electionListCacheVersion;
  const request = api.get<{ data: Election[] }>("/elections", {
    params: status ? { status } : undefined,
  })
    .then((response) => {
      const payload = response.data.data;
      if (cacheVersionAtRequest === electionListCacheVersion) {
        electionListCache.set(key, {
          data: payload,
          expiresAt: Date.now() + ELECTION_LIST_CACHE_TTL_MS,
        });
      }
      return payload;
    })
    .finally(() => {
      if (electionListInFlightRequests.get(key) === request) {
        electionListInFlightRequests.delete(key);
      }
    });

  electionListInFlightRequests.set(key, request);
  return request;
}

export async function getElection(electionId: number) {
  const existingRequest = electionInFlightRequests.get(electionId);
  if (existingRequest) {
    return existingRequest;
  }

  const request = api
    .get<{ data: Election }>(`/elections/${electionId}`)
    .then((response) => response.data.data)
    .finally(() => {
      electionInFlightRequests.delete(electionId);
    });

  electionInFlightRequests.set(electionId, request);

  return request;
}

export async function getElectionPreview(electionId: number) {
  const response = await api.get<{ data: Election }>(`/preview/elections/${electionId}`);
  return response.data.data;
}

export async function createElection(payload: ElectionPayload) {
  const response = await api.post<{ data: Election }>("/elections", payload);
  clearElectionsCache();
  return response.data.data;
}

export async function updateElection(electionId: number, payload: Partial<ElectionPayload>) {
  const response = await api.put<{ data: Election }>(`/elections/${electionId}`, payload);
  clearElectionsCache();
  return response.data.data;
}

export async function deleteElection(electionId: number) {
  await api.delete(`/elections/${electionId}`);
  clearElectionsCache();
}

export async function createPosition(electionId: number, payload: PositionPayload) {
  const response = await api.post<{ data: Position }>(`/elections/${electionId}/positions`, payload);
  return response.data.data;
}

export async function reorderPositions(electionId: number, positionIds: number[]) {
  const response = await api.patch<{ data: Position[] }>(`/elections/${electionId}/positions/reorder`, {
    positions: positionIds,
  });

  return response.data.data;
}

export async function createCandidate(electionId: number, payload: CandidatePayload) {
  const formData = new FormData();
  formData.append("position_id", String(payload.position_id));
  formData.append("name", payload.name);

  if (payload.bio) {
    formData.append("bio", payload.bio);
  }

  if (payload.photo) {
    formData.append("photo", payload.photo);
  }

  const response = await api.post<{ data: Candidate }>(`/elections/${electionId}/candidates`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data.data;
}

export async function updateCandidate(electionId: number, candidateId: number, payload: CandidateUpdatePayload) {
  const formData = new FormData();

  if (typeof payload.position_id === "number") {
    formData.append("position_id", String(payload.position_id));
  }

  if (typeof payload.name === "string") {
    formData.append("name", payload.name);
  }

  if (typeof payload.bio === "string") {
    formData.append("bio", payload.bio);
  }

  if (payload.photo) {
    formData.append("photo", payload.photo);
  }

  const response = await api.patch<{ data: Candidate }>(
    `/elections/${electionId}/candidates/${candidateId}`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data.data;
}

export async function deleteCandidate(electionId: number, candidateId: number) {
  await api.delete(`/elections/${electionId}/candidates/${candidateId}`);
}
