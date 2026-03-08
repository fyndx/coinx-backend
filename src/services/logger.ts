import pino from "pino";
import { env } from "../lib/env";

// Create transport configuration based on environment
const createTransport = () => {
	if (env.NODE_ENV === "development") {
		// Development: pretty printing only
		return pino.transport({
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "HH:MM:ss Z",
				ignore: "pid,hostname",
			},
		});
	}

	// Production: multiple targets
	const targets: pino.TransportTargetOptions[] = [];

	// Always log to stdout in production (for Coolify/Docker logs)
	targets.push({
		target: "pino/file",
		options: { destination: 1 }, // 1 = stdout
		level: "info",
	});

	// Add Better Stack if token is configured
	if (env.BETTERSTACK_SOURCE_TOKEN) {
		targets.push({
			target: "@logtail/pino",
			options: {
				sourceToken: env.BETTERSTACK_SOURCE_TOKEN,
			},
			level: "info",
		});
	}

	return pino.transport({ targets });
};

// Create logger with appropriate transport
export const logger = pino(
	{
		level: env.NODE_ENV === "development" ? "debug" : "info",
		timestamp: pino.stdTimeFunctions.isoTime,
	},
	createTransport(),
);

// Type-safe logger methods
export type Logger = typeof logger;

// Helper functions for common logging patterns
export const logRequest = (
	method: string,
	path: string,
	requestId: string,
	userId?: string,
) => {
	logger.info({ method, path, requestId, userId }, "Incoming request");
};

export const logResponse = (
	method: string,
	path: string,
	status: number,
	duration: number,
	requestId: string,
) => {
	logger.info({ method, path, status, duration, requestId }, "Response sent");
};

export const logError = (error: Error, context?: Record<string, unknown>) => {
	logger.error({ err: error, ...context }, error.message);
};

export const logDatabaseQuery = (query: string, duration?: number) => {
	logger.debug({ query, duration }, "Database query");
};
