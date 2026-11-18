const configuredApiUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();

const isLocalhost =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

const apiUrl =
  (isLocalhost
    ? `http://${window.location.hostname}:5080/api/v1`
    : configuredApiUrl) ||
  (typeof window === "undefined"
    ? "http://localhost:5080/api/v1"
    : `${window.location.protocol}//${window.location.hostname}:5080/api/v1`);

export const config = { apiUrl: apiUrl.replace(/\/+$/, "") };
