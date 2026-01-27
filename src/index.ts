import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { healthRoutes } from "./routes/health";
import { env } from "./lib/env";
import { AppError } from "./lib/errors";

const app = new Elysia()
	.use(
		cors({
			origin: true, // Allow all origins during development
			methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
			allowedHeaders: ["Content-Type", "Authorization"],
		}),
	)
	// Global error handler — catches all unhandled errors
	.onError(({ code, error, set }) => {
		// ElysiaJS validation errors
		if (code === "VALIDATION") {
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
			set.status = error.status;
			return error.toResponse();
		}

		// ElysiaJS NOT_FOUND (route not found)
		if (code === "NOT_FOUND") {
			set.status = 404;
			return {
				error: {
					code: "RESOURCE_NOT_FOUND",
					message: "Route not found",
					status: 404,
				},
			};
		}

		// Unexpected errors — log full details, return generic message
		console.error(`[Unhandled Error] ${code}:`, error);
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
	.listen(env.PORT);

console.log(
	`🪙 CoinX Backend running at http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
