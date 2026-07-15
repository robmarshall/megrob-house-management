/**
 * ApiError - Error class thrown by the API client for non-ok HTTP responses.
 *
 * Extends the built-in Error so that `error instanceof Error` holds true
 * (preserving stack traces for error boundaries / logging), while still
 * exposing `.status` and `.details` for consumers that need them
 * (e.g. `shouldRetryQuery` in `queryClient.ts`, toast error messages).
 */
export class ApiError extends Error {
  public status: number;
  public details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    // Set the prototype explicitly so `instanceof ApiError` works correctly
    // when compiling to targets where extending built-ins is broken.
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}
