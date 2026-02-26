import { api } from "@/api/client";
import type { DashboardOverview } from "@/api/types";

export async function getDashboardOverview() {
  const response = await api.get<{ data: DashboardOverview }>("/dashboard/overview");
  return response.data.data;
}
