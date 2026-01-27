import { Elysia } from "elysia";
import { prisma } from "../lib/prisma";

export const healthRoutes = new Elysia({ prefix: "/api" }).get(
	"/health",
	async () => {
		let dbStatus = "disconnected";

		try {
			await prisma.$queryRaw`SELECT 1`;
			dbStatus = "connected";
		} catch {
			dbStatus = "error";
		}

		return {
			status: "ok",
			service: "coinx-backend",
			timestamp: new Date().toISOString(),
			database: dbStatus,
		};
	},
);
