import { Elysia } from "elysia";
import { prisma } from "../lib/prisma";
import { useLogger } from "evlog/elysia";

export const healthRoutes = new Elysia({ prefix: "/api" }).get(
	"/health",
	async ({ set }) => {
		const log = useLogger();
		let dbStatus: "connected" | "disconnected" | "error" = "disconnected";
		let dbLatencyMs: number | null = null;

		try {
			const start = Date.now();
			await prisma.$queryRaw`SELECT 1`;
			dbLatencyMs = Date.now() - start;
			dbStatus = "connected";
		} catch (error) {
			dbStatus = "error";
			console.error("[Health Check] Database connection failed:", error);
		}

		const healthy = dbStatus === "connected";

		// Attach DB diagnostics to the wide event
		log.set({ db: { status: dbStatus, latencyMs: dbLatencyMs, healthy } });

		if (!healthy) {
			set.status = 503;
		}

		return {
			status: healthy ? "ok" : "degraded",
			service: "coinx-backend",
			timestamp: new Date().toISOString(),
			database: {
				status: dbStatus,
				latencyMs: dbLatencyMs,
			},
		};
	},
);
