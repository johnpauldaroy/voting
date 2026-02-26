import { api } from "@/api/client";
import type { AuditLog, PaginationMeta } from "@/api/types";

export async function getAuditLogs(page = 1, perPage = 25) {
  const response = await api.get<{ data: AuditLog[]; meta: PaginationMeta }>("/audit-logs", {
    params: {
      page,
      per_page: perPage,
    },
  });

  return response.data;
}
