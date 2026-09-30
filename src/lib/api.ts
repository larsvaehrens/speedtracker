export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      throw new Error("The server returned an unreadable response.");
    }
    throw error;
  }

  if (!isRecord(payload)) {
    throw new Error("The server returned an invalid response.");
  }
  if (!response.ok) {
    const message =
      typeof payload.error === "string"
        ? payload.error
        : typeof payload.message === "string"
          ? payload.message
          : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export function apiMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The request failed. Check your connection and try again.";
}
