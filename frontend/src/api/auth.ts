import axios from "axios";
import { api, ensureCsrfCookie } from "@/api/client";
import type { User } from "@/api/types";

export interface LoginPayload {
  login_type?: "email" | "voter";
  email?: string;
  password?: string;
  voter_id?: string;
  voter_key?: string;
  remember?: boolean;
}

export interface VoterAccessPreviewPayload {
  election_id: number;
  voter_id: string;
  voter_key: string;
}

export interface VoterAccessPreviewResponse {
  voter: {
    name: string;
    branch: string | null;
    voter_id: string | null;
    is_active: boolean;
    has_voted: boolean;
    voted_at: string | null;
  };
  election: {
    id: number;
    title: string;
    status: "draft" | "open" | "closed";
    start_datetime: string;
    end_datetime: string;
  };
  can_proceed: boolean;
  reason: string | null;
}

export async function login(payload: LoginPayload) {
  await ensureCsrfCookie();

  try {
    const response = await api.post<{ data: User }>("/login", payload);
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 419) {
      await ensureCsrfCookie();
      const retry = await api.post<{ data: User }>("/login", payload);
      return retry.data.data;
    }

    throw error;
  }
}

export async function logout() {
  await api.post<{ message: string }>("/logout");
}

export async function getCurrentUser() {
  const response = await api.get<{ data: User }>("/user");
  return response.data.data;
}

export async function previewVoterAccess(payload: VoterAccessPreviewPayload) {
  const response = await api.post<{ data: VoterAccessPreviewResponse }>("/voter-access/preview", payload);
  return response.data.data;
}
