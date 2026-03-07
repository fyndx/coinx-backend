import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { env } from "./env";
import { logger, logDatabaseQuery } from "../services/logger";

const pool = new pg.Pool({
	connectionString: env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

// Singleton pattern - reuse client across hot reloads in development
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		adapter,
		log: [
			{ level: "query", emit: "event" },
			{ level: "error", emit: "event" },
			{ level: "warn", emit: "event" },
		],
	});

// Log database queries with timing
prisma.$on("query", (e) => {
	logDatabaseQuery(e.query, e.duration);
});

// Log database errors
prisma.$on("error", (e) => {
	logger.error({ target: e.target }, e.message);
});

// Log database warnings
prisma.$on("warn", (e) => {
	logger.warn({ target: e.target }, e.message);
});

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}
