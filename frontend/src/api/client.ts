import axios from "axios";

const normalizeUrl = (value: string) => value.replace(/\/+$/, "");

const apiOriginFromEnv = import.meta.env.VITE_API_ORIGIN ?? import.meta.env.VITE_API_URL ?? "";
const API_ORIGIN = normalizeUrl(apiOriginFromEnv);
const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

const API_BASE_URL = (() => {
  if (rawBaseUrl && rawBaseUrl !== "/api") {
    return normalizeUrl(rawBaseUrl);
  }

  if (API_ORIGIN) {
    return `${API_ORIGIN}/api`;
  }

  return "/api";
})();

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  headers: {
    "X-Requested-With": "XMLHttpRequest",
    Accept: "application/json",
  },
});

export async function ensureCsrfCookie() {
  await axios.get(`${API_ORIGIN || ""}/sanctum/csrf-cookie`, {
    withCredentials: true,
    withXSRFToken: true,
    xsrfCookieName: "XSRF-TOKEN",
    xsrfHeaderName: "X-XSRF-TOKEN",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
    },
  });
}

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;

    if (data?.errors) {
      const firstField = Object.values(data.errors)[0];
      if (firstField?.[0]) {
        return firstField[0];
      }
    }

    if (data?.message) {
      return data.message;
    }
  }

  return "An unexpected error occurred.";
}
