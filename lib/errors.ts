import { z } from "zod";

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    fieldErrors?: Record<string, string[]>,
    details?: Record<string, unknown>
  ) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }

  static fromZodError(error: z.ZodError): ValidationError {
    const fieldErrors: Record<string, string[]> = {};

    for (const issue of error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }

    return new ValidationError("Validation failed", fieldErrors, {
      issues: error.issues,
    });
  }

  override toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fieldErrors && { fieldErrors: this.fieldErrors }),
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with ID '${id}' not found`
      : `${resource} not found`;
    super(message, "NOT_FOUND", 404, { resource, id });
    this.name = "NotFoundError";
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, "AUTHENTICATION_REQUIRED", 401);
    this.name = "AuthenticationError";
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends AppError {
  constructor(
    message: string = "You do not have permission to perform this action",
    requiredPermission?: string
  ) {
    super(message, "FORBIDDEN", 403, { requiredPermission });
    this.name = "AuthorizationError";
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFLICT", 409, details);
    this.name = "ConflictError";
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message: string = "Rate limit exceeded", retryAfter?: number) {
    super(message, "RATE_LIMIT_EXCEEDED", 429, { retryAfter });
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * External service error (502)
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(service: string, message: string, details?: Record<string, unknown>) {
    super(`${service}: ${message}`, "EXTERNAL_SERVICE_ERROR", 502, {
      service,
      ...details,
    });
    this.name = "ExternalServiceError";
    this.service = service;
  }
}

/**
 * Channel delivery error
 */
export class DeliveryError extends AppError {
  public readonly channelType: string;
  public readonly retryable: boolean;

  constructor(
    channelType: string,
    message: string,
    retryable: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message, "DELIVERY_ERROR", 500, { channelType, retryable, ...details });
    this.name = "DeliveryError";
    this.channelType = channelType;
    this.retryable = retryable;
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return ValidationError.fromZodError(error);
  }

  if (error instanceof Error) {
    return new AppError(error.message, "INTERNAL_ERROR", 500, {
      originalError: error.name,
    });
  }

  return new AppError(
    typeof error === "string" ? error : "An unexpected error occurred",
    "INTERNAL_ERROR",
    500
  );
}

/**
 * Error response type for API responses
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    fieldErrors?: Record<string, string[]>;
  };
}

/**
 * Create an error response from an error
 */
export function createErrorResponse(error: unknown): ErrorResponse {
  const appError = toAppError(error);
  return appError.toJSON() as ErrorResponse;
}
