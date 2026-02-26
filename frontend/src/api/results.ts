import { api } from "@/api/client";
import type { ElectionResult } from "@/api/types";

export async function getElectionResults(electionId: number) {
  const response = await api.get<{ data: ElectionResult }>(`/elections/${electionId}/results`);
  return response.data.data;
}

export async function downloadResultsCsv(electionId: number) {
  const response = await api.get<Blob>(`/elections/${electionId}/results/export`, {
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `election_${electionId}_results.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
