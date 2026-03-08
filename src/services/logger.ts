import pino from "pino";
import { env } from "../lib/env";

const createDevelopmentTransport = () => ({
	target: "pino-pretty",
	options: {
		colorize: true,
		translateTime: "HH:MM:ss Z",
		ignore: "pid,hostname",
	},
});

const createProductionTransport = () => {
	if (env.BETTERSTACK_SOURCE_TOKEN) {
		return {
			target: "pino-http-send",
			options: {
				url: "https://in.logs.betterstack.com",
				headers: {
					Authorization: `Bearer ${env.BETTERSTACK_SOURCE_TOKEN}`,
					"Content-Type": "application/json",
				},
				batchSize: 10,
				retries: 3,
				interval: 5000,
				timeout: 10000,
				// Silently fail if Better Stack is unreachable
				errorHandler: (err: Error) => {
					console.error("Better Stack logging error:", err.message);
				},
			},
		};
	}
	return undefined; // Fallback to default JSON logging to stdout
}

const createTransport = () => {
	if (env.NODE_ENV === "development") {
		return createDevelopmentTransport();
	} else {
		return createProductionTransport();
	}
}

const logLevel = env.NODE_ENV === "development" ? "debug" : "info";
const transport = createTransport();

// Create logger with pretty printing in development, direct HTTP to Better Stack in production
export const logger = pino({
	level: logLevel,
	transport: transport,
});

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
