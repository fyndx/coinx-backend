import pino from "pino";
import { env } from "../lib/env";

// Create logger with pretty printing in development, HTTP transport in production
export const logger = pino({
	level: env.NODE_ENV === "production" ? "info" : "debug",
	transport:
		env.NODE_ENV === "development"
			? {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "HH:MM:ss Z",
						ignore: "pid,hostname",
					},
				}
			: env.BETTERSTACK_SOURCE_TOKEN
				? {
						target: "pino-http-send",
						options: {
							url: "https://in.logs.betterstack.com",
							headers: {
								Authorization: `Bearer ${env.BETTERSTACK_SOURCE_TOKEN}`,
								"Content-Type": "application/json",
							},
							batchSize: 10,
							retryBackoff: 1000,
						},
					}
				: undefined,
});

// Type-safe logger methods
export type Logger = typeof logger;

// Helper functions for common logging patterns
export const logRequest = (method: string, path: string, userId?: string) => {
	logger.info({ method, path, userId }, "Incoming request");
};

export const logResponse = (
	method: string,
	path: string,
	status: number,
	duration: number,
) => {
	logger.info({ method, path, status, duration }, "Response sent");
};

export const logError = (error: Error, context?: Record<string, unknown>) => {
	logger.error({ err: error, ...context }, error.message);
};

export const logDatabaseQuery = (query: string, duration?: number) => {
	logger.debug({ query, duration }, "Database query");
};
