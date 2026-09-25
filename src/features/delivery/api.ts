import { z } from "zod";
const configuredBase =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "") ?? "";
export const apiEnabled = configuredBase.length > 0;
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
let csrfToken: string | undefined;
let bootstrap: Promise<void> | undefined;
const csrfSchema = z.object({ csrfToken: z.string().min(1) });
function base() {
  if (!apiEnabled)
    throw new ApiError("not_configured", "Backend delivery is not configured.");
  const url = new URL(configuredBase);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new ApiError("invalid_configuration", "Invalid backend URL.");
  return configuredBase;
}
async function read(response: Response): Promise<unknown> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      "invalid_response",
      "The server returned an unreadable response.",
      response.status,
    );
  }
  const envelope = z
    .object({
      data: z.unknown().optional(),
      error: z.object({ code: z.string(), message: z.string() }).optional(),
    })
    .safeParse(payload);
  if (!response.ok) {
    const error = envelope.success ? envelope.data.error : undefined;
    throw new ApiError(
      error?.code ?? "unavailable",
      error?.message ??
        "The delivery service is unavailable. Please try again.",
      response.status,
    );
  }
  if (
    !envelope.success ||
    !payload ||
    typeof payload !== "object" ||
    !("data" in payload)
  )
    throw new ApiError(
      "invalid_response",
      "The server returned an unexpected response.",
      response.status,
    );
  return envelope.data.data;
}
async function fetchSafe(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
) {
  try {
    return await fetch(base() + path, {
      ...init,
      credentials: "include",
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
        : AbortSignal.timeout(12000),
    });
  } catch (error) {
    if (signal?.aborted)
      throw new DOMException("Request cancelled", "AbortError");
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "unavailable",
      "Unable to reach the delivery service. Check your connection and try again.",
    );
  }
}
async function ensureSession() {
  if (csrfToken) return;
  if (!bootstrap)
    bootstrap = (async () => {
      const data = await read(await fetchSafe("/auth/csrf", {}));
      csrfToken = csrfSchema.parse(data).csrfToken;
    })().finally(() => {
      bootstrap = undefined;
    });
  await bootstrap;
}
export type RequestOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
};
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[?#]/.test(path.split("?")[0] ?? "")
  )
    throw new ApiError("invalid_path", "Invalid request path.");
  await ensureSession();
  options.signal?.throwIfAborted();
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-Token"] = csrfToken!;
  if (options.idempotencyKey)
    headers["Idempotency-Key"] = options.idempotencyKey;
  try {
    const data = await read(
      await fetchSafe(
        path,
        {
          method,
          headers,
          ...(options.body !== undefined
            ? { body: JSON.stringify(options.body) }
            : {}),
        },
        options.signal,
      ),
    );
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw new ApiError(
        "invalid_response",
        "The server returned an unexpected delivery response.",
      );
    const fresh = csrfSchema.safeParse(data);
    if (fresh.success) csrfToken = fresh.data.csrfToken;
    if (path === "/auth/logout") csrfToken = undefined;
    return parsed.data;
  } catch (error) {
    if (
      error instanceof ApiError &&
      ["csrf_failed", "unauthorized"].includes(error.code)
    )
      csrfToken = undefined;
    throw error;
  }
}
export const idempotencyKey = () => crypto.randomUUID();
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
