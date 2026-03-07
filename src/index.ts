import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { syncRoutes } from "./routes/sync";
import { env } from "./lib/env";
import { AppError } from "./lib/errors";
import { errorTracking } from "./services/error-tracking";
import { logger, logError } from "./services/logger";

// Initialize error tracking (Better Stack via Sentry SDK)
errorTracking.initialize(env.SENTRY_DSN, env.NODE_ENV);

const app = new Elysia()
	.use(
		cors({
			origin: true, // Allow all origins during development
			methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
			allowedHeaders: ["Content-Type", "Authorization"],
		}),
	)
	// Request/Response logging
	.onRequest(({ request }) => {
		const start = Date.now();
		logger.info(
			{
				method: request.method,
				path: new URL(request.url).pathname,
			},
			"Incoming request",
		);
		// Store start time for response logging
		request.headers.set("x-request-start", start.toString());
	})
	.onAfterResponse(({ request, set }) => {
		const start = Number.parseInt(
			request.headers.get("x-request-start") || "0",
		);
		const duration = Date.now() - start;
		logger.info(
			{
				method: request.method,
				path: new URL(request.url).pathname,
				status: set.status,
				duration: `${duration}ms`,
			},
			"Response sent",
		);
	})
	// Global error handler — catches all unhandled errors
	.onError(({ code, error, set, request }) => {
		// ElysiaJS validation errors
		if (code === "VALIDATION") {
			logger.warn(
				{
					path: new URL(request.url).pathname,
					error: error.message,
				},
				"Validation error",
			);
			set.status = 422;
			return {
				error: {
					code: "VALIDATION_ERROR",
					message: "Invalid request",
					status: 422,
					details: [{ message: error.message }],
				},
			};
		}

		// Our custom AppError
		if (error instanceof AppError) {
			// Log expected errors at info level, don't send to error tracking
			logger.info(
				{
					code: error.code,
					status: error.status,
					path: new URL(request.url).pathname,
				},
				error.message,
			);
			set.status = error.status;
			return error.toResponse();
		}

		// ElysiaJS NOT_FOUND (route not found)
		if (code === "NOT_FOUND") {
			logger.warn(
				{ path: new URL(request.url).pathname },
				"Route not found",
			);
			set.status = 404;
			return {
				error: {
					code: "RESOURCE_NOT_FOUND",
					message: "Route not found",
					status: 404,
				},
			};
		}

		// Unexpected errors — log full details, send to error tracking, return generic message
		logError(error as Error, {
			code,
			path: new URL(request.url).pathname,
		});
		errorTracking.captureException(error);
		set.status = 500;
		return {
			error: {
				code: "INTERNAL_ERROR",
				message: "An unexpected error occurred",
				status: 500,
			},
		};
	})
	.use(healthRoutes)
	.use(authRoutes)
	.use(syncRoutes)
	.listen(env.PORT);

logger.info(
	{
		host: app.server?.hostname,
		port: app.server?.port,
		environment: env.NODE_ENV,
	},
	"🪙 CoinX Backend started",
);

export type App = typeof app;
