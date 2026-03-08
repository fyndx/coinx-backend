import * as Sentry from "@sentry/bun";
import { env } from "../lib/env";
import { logger } from "./logger";

export interface ErrorTrackingService {
	initialize(): void;
	captureException(error: Error | unknown, context?: Record<string, unknown>): void;
	captureMessage(message: string, level?: "info" | "warning" | "error"): void;
	setUser(user: { id: string; email?: string; username?: string }): void;
	setContext(key: string, context: Record<string, unknown>): void;
}

class SentryErrorTrackingService implements ErrorTrackingService {
	dsn: string;
	environment: string;
	canTrack: boolean = false;

	constructor() {
		this.dsn = env.SENTRY_DSN;
		this.environment = env.NODE_ENV;
	}

	initialize(): void {
		if (!this.dsn) {
			logger.warn("SENTRY_DSN not configured, error tracking disabled");
			return;
		}
		
		Sentry.init({
			dsn: this.dsn,
			environment: this.environment,
			tracesSampleRate: 0.1,
		});
		this.canTrack = true;
		logger.info("Sentry error tracking initialized");
	}

	captureException(error: Error | unknown, context?: Record<string, unknown>): void {
		if (!this.canTrack) {
			return;
		}

		if (context) {
			Sentry.withScope((scope) => {
				scope.setContext("additional", context);
				Sentry.captureException(error);
			});
		} else {
			Sentry.captureException(error);
		}
	}

	captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
		if (!this.canTrack) {
			return;
		}

		Sentry.captureMessage(message, level);
	}

	setUser(user: { id: string; email?: string; username?: string }): void {
		if (!this.canTrack) {
			return;
		}
		
		Sentry.setUser(user);
	}

	setContext(key: string, context: Record<string, unknown>): void {
		if (!this.canTrack) {
			return;
		}

		Sentry.setContext(key, context);
	}
}

// Singleton instance
export const errorTracking: ErrorTrackingService = new SentryErrorTrackingService();
