type ApiEnvelope = {
  success?: unknown;
  error?: unknown;
  code?: unknown;
  data?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function responseError(response: Response, envelope: ApiEnvelope, fallback: string) {
  const code = typeof envelope.code === "string" ? envelope.code : "";
  const message = typeof envelope.error === "string" ? envelope.error : "";

  if (code === "INTERNAL_ERROR" || response.status >= 500) {
    return "The server could not complete this request. Please try again. If the problem continues, contact support.";
  }
  if (response.status === 401) {
    return "Your session may have expired. Sign in again, then retry.";
  }
  if (response.status === 429) {
    return "Too many requests. Wait a moment and try again.";
  }
  if (message && message.toLowerCase() !== "internal server error") {
    return message;
  }
  return fallback;
}

export async function readApiData<T>(response: Response, fallback: string): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const envelope: ApiEnvelope = isRecord(payload) ? payload : {};
  if (!response.ok || envelope.success !== true) {
    throw new Error(responseError(response, envelope, fallback));
  }

  return envelope.data as T;
}

export function clientErrorMessage(error: unknown, fallback: string) {
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return error instanceof Error ? error.message : fallback;
}
