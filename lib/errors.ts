/** Shared error contract. Keep this module safe for both browser and server imports. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, status = 400) {
    super(status, message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends HttpError {
  constructor() {
    super(409, "This quiz changed in another tab. Reload before saving to avoid overwriting those changes.");
    this.name = "ConflictError";
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message = "The service is temporarily unavailable. Please try again.", retryAfterSeconds?: number) {
    super(503, message, retryAfterSeconds);
    this.name = "ServiceUnavailableError";
  }
}

/** Translate only request-body parsing failures, never internal JSON parsing bugs. */
export async function readJsonRequest(request: Request): ReturnType<Request["json"]> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new ValidationError("Send a JSON object request.");
    return value;
  } catch (error) {
    if (error instanceof SyntaxError) throw new ValidationError("Send a valid JSON request.");
    throw error;
  }
}
