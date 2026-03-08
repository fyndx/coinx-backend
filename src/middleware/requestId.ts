import { Elysia } from "elysia";
import { randomUUID } from "node:crypto";

/**
 * Request ID middleware for request correlation
 * Extracts or generates a unique request ID for tracing
 */
export const requestIdMiddleware = new Elysia({ name: "request-id" })
	.derive(({ request, set }) => {
		// Try to get request ID from header, otherwise generate new one
		const requestId =
			(request.headers.get("x-request-id") as string) ||
			(request.headers.get("x-correlation-id") as string) ||
			randomUUID();

		// Add to response headers for client tracking
		set.headers["x-request-id"] = requestId;

		return {
			requestId,
		};
	});
