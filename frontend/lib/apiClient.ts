// File: src/lib/apiClient.ts
"use client";

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: HeadersInit = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (options.body instanceof FormData) {
    delete defaultHeaders["Content-Type"];
  } else {
    defaultHeaders["Content-Type"] = "application/json";
  }

  const config: RequestInit = {
    method: "GET",
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
    cache: "no-store",
  };

  let retries = 3;
  let lastError: Error | null = null;

  while (retries > 0) {
    try {
      console.log(`Making request to ${url} with method ${config.method || "GET"}`);
      const response = await fetch(url, config);
      console.log(`Response status: ${response.status}, ok: ${response.ok}, headers:`, [...response.headers]);

      if (response.status === 401) {
        throw new Error("Unauthorized: Invalid or missing authentication token");
      }

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          console.error("Failed to parse error response:", e);
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return (await response.json()) as T;
      }

      return {} as T;
    } catch (err: any) {
      lastError = err;
      console.error(`API request failed: ${err.message}`);
      retries--;

      if (err.message.includes("Failed to fetch")) {
        throw new Error("Unable to connect to the server. Please ensure the backend is running.");
      }

      if (retries === 0 || err.message.includes("Unauthorized")) {
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError || new Error("Unknown error occurred");
}