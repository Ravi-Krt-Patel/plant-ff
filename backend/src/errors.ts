export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function requireValue<T>(
  value: T | null | undefined,
  message = "Resource not found",
): T {
  if (value === undefined || value === null)
    throw new ApiError(404, "not_found", message);
  return value;
}
