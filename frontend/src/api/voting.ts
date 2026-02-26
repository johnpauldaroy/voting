import { api } from "@/api/client";
import type { VotePayload, VoteReceipt } from "@/api/types";

export async function castVote(payload: VotePayload) {
  const response = await api.post<{ data: VoteReceipt }>("/vote", payload);
  return response.data.data;
}
