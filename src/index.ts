import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { initLogger } from "evlog";
import { evlog } from "evlog/elysia";
import { healthController } from "./modules/health";
import { authController } from "./modules/auth";
import { syncController } from "./modules/sync";
import { env } from "./common/env";
import { AppError } from "./common/errors";
import { errorTracking } from "./common/services/error-tracking";
import { logger, logError } from "./common/services/logger";
import { requestIdMiddleware } from "./common/middleware/request-id.middleware";
import { prisma } from "./common/services/prisma";

// Initialize error tracking (Better Stack via Sentry SDK)
errorTracking.initialize();

// Initialize evlog — sets service name used in all structured log events
initLogger({ env: { service: "coinx-backend" } });

const app = new Elysia()
	.use(
		cors({
			origin: true, // Allow all origins during development
			methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
			allowedHeaders: ["Content-Type", "Authorization"],
		}),
	)
	// Structured request-scoped logging via evlog — one wide event per request
	.use(
		evlog({
			include: ["/api/**"],
			// Force-retain slow requests and errors regardless of any head sampling
			keep: (ctx) => {
				if (ctx.duration && ctx.duration > 2000) ctx.shouldKeep = true;
			},
			// Enrich every event with the runtime environment
			enrich: (ctx) => {
				ctx.event.environment = env.NODE_ENV;
			},
		}),
	)
	// Add request ID correlation
	.use(requestIdMiddleware)
	// Request/Response logging
	.onRequest((context) => {
		const { request, requestId, store } = context as typeof context & { requestId: string };
		logger.info(
			{
				method: request.method,
				path: new URL(request.url).pathname,
				requestId,
			},
			"Incoming request",
		);
		// Store start time for response logging
		(store as { requestStart?: number }).requestStart = Date.now();
	})
	.onAfterResponse((context) => {
		const { request, set, requestId, store } = context as typeof context & { requestId: string };
		const duration = Date.now() - ((store as { requestStart?: number }).requestStart || Date.now());
		logger.info(
			{
				method: request.method,
				path: new URL(request.url).pathname,
				status: set.status,
				duration: `${duration}ms`,
				requestId,
			},
			"Response sent",
		);
	})
	// Global error handler — catches all unhandled errors
	.onError((context) => {
		const { code, error, set, request, requestId } = context as typeof context & { requestId: string };
		// ElysiaJS validation errors
		if (code === "VALIDATION") {
			logger.warn(
				{
					path: new URL(request.url).pathname,
					requestId,
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
					requestId,
				},
				error.message,
			);
			set.status = error.status;
			return error.toResponse();
		}

		// ElysiaJS NOT_FOUND (route not found)
		if (code === "NOT_FOUND") {
			logger.warn(
				{ path: new URL(request.url).pathname, requestId },
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

		// Unexpected errors — log full details, send to error tracking with rich context
		const errorContext = {
			code,
			path: new URL(request.url).pathname,
			requestId,
			method: request.method,
			userAgent: request.headers.get("user-agent") || undefined,
		};
		
		logError(error as Error, errorContext);
		errorTracking.captureException(error, errorContext);
		set.status = 500;
		return {
			error: {
				code: "INTERNAL_ERROR",
				message: "An unexpected error occurred",
				status: 500,
			},
		};
	})
	.use(healthController)
	.use(authController)
	.use(syncController)
	.listen(env.PORT);

logger.info(
	{
		host: app.server?.hostname,
		port: app.server?.port,
		environment: env.NODE_ENV,
	},
	"🪙 CoinX Backend started",
);

// Graceful shutdown handling
const gracefulShutdown = async (signal: string, isErrorShutdown = false) => {
	logger.info({ signal }, "Received shutdown signal, starting graceful shutdown...");

	try {
		// Stop accepting new connections
		app.server?.stop();
		logger.info("Server stopped accepting new connections");

		// Close database connections
		await prisma.$disconnect();
		logger.info("Database connections closed");

		logger.info("Graceful shutdown completed");
		process.exit(isErrorShutdown ? 1 : 0);
	} catch (error) {
		logger.error({ err: error }, "Error during graceful shutdown");
		process.exit(1);
	}
};

// Listen for termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
	logger.error({ err: error }, "Uncaught exception");
	errorTracking.captureException(error);
	gracefulShutdown("uncaughtException", true);
});

process.on("unhandledRejection", (reason) => {
	logger.error({ err: reason }, "Unhandled promise rejection");
	errorTracking.captureException(reason as Error);
	gracefulShutdown("unhandledRejection", true);
});

export type App = typeof app;
