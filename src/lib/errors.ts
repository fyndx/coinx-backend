/**
 * Structured error handling for CoinX Backend.
 *
 * Every error that reaches the client follows a consistent format.
 * Internal details are logged server-side but never leaked.
 */

export type ErrorCode =
	| "VALIDATION_ERROR"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "RESOURCE_NOT_FOUND"
	| "CONFLICT"
	| "RATE_LIMITED"
	| "INTERNAL_ERROR"
	| "SERVICE_UNAVAILABLE";

export interface ErrorDetail {
	field?: string;
	message: string;
}

export interface ErrorResponse {
	error: {
		code: ErrorCode;
		message: string;
		status: number;
		details?: ErrorDetail[];
	};
}

/**
 * Application error — throw this in business logic.
 * The global error handler catches it and returns a structured response.
 */
export class AppError extends Error {
	public readonly code: ErrorCode;
	public readonly status: number;
	public readonly details?: ErrorDetail[];

	constructor(
		code: ErrorCode,
		message: string,
		status: number,
		details?: ErrorDetail[],
	) {
		super(message);
		this.name = "AppError";
		this.code = code;
		this.status = status;
		this.details = details;
	}

	toResponse(): ErrorResponse {
		return {
			error: {
				code: this.code,
				message: this.message,
				status: this.status,
				...(this.details && { details: this.details }),
			},
		};
	}
}

// ─── Convenience factories ───────────────────────────────────

export const Errors = {
	validation: (message: string, details?: ErrorDetail[]) =>
		new AppError("VALIDATION_ERROR", message, 422, details),

	unauthorized: (message = "Authentication required") =>
		new AppError("UNAUTHORIZED", message, 401),

	forbidden: (message = "Insufficient permissions") =>
		new AppError("FORBIDDEN", message, 403),

	notFound: (resource: string) =>
		new AppError("RESOURCE_NOT_FOUND", `${resource} not found`, 404),

	conflict: (message: string) =>
		new AppError("CONFLICT", message, 409),

	rateLimited: (message = "Too many requests") =>
		new AppError("RATE_LIMITED", message, 429),

	internal: (message = "An unexpected error occurred") =>
		new AppError("INTERNAL_ERROR", message, 500),

	serviceUnavailable: (service: string) =>
		new AppError(
			"SERVICE_UNAVAILABLE",
			`${service} is temporarily unavailable`,
			503,
		),
} as const;

/**
 * Check if an error is a known Prisma error.
 * Maps common Prisma error codes to user-friendly AppErrors.
 */
export function handlePrismaError(error: unknown): AppError {
	if (error && typeof error === "object" && "code" in error) {
		const prismaError = error as { code: string; meta?: Record<string, unknown> };

		switch (prismaError.code) {
			case "P2002": // Unique constraint violation
				return Errors.conflict(
					`A record with this value already exists${
						prismaError.meta?.target
							? ` (${String(prismaError.meta.target)})`
							: ""
					}`,
				);
			case "P2025": // Record not found
				return Errors.notFound("Record");
			case "P2003": // Foreign key constraint
				return Errors.validation("Referenced record does not exist");
			case "P2024": // Connection pool timeout
				return Errors.serviceUnavailable("Database");
			default:
				console.error("[Prisma Error]", prismaError.code, prismaError.meta);
				return Errors.internal();
		}
	}

	console.error("[Unknown Error]", error);
	return Errors.internal();
}
