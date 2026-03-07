import * as Sentry from "@sentry/bun";

export interface ErrorTrackingService {
	initialize(dsn: string, environment: string): void;
	captureException(error: Error | unknown, context?: Record<string, unknown>): void;
	captureMessage(message: string, level?: "info" | "warning" | "error"): void;
	setUser(user: { id: string; email?: string; username?: string }): void;
	setContext(key: string, context: Record<string, unknown>): void;
}

class SentryErrorTrackingService implements ErrorTrackingService {
	initialize(dsn: string, environment: string): void {
		Sentry.init({
			dsn,
			environment,
			tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
		});
	}

	captureException(error: Error | unknown, context?: Record<string, unknown>): void {
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
		Sentry.captureMessage(message, level);
	}

	setUser(user: { id: string; email?: string; username?: string }): void {
		Sentry.setUser(user);
	}

	setContext(key: string, context: Record<string, unknown>): void {
		Sentry.setContext(key, context);
	}
}

// Singleton instance
export const errorTracking: ErrorTrackingService = new SentryErrorTrackingService();
