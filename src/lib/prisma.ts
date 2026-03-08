import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { env } from "./env";

const pool = new pg.Pool({
	connectionString: env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

// Singleton pattern - reuse client across hot reloads in development
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

// Configure logging based on environment
const logConfig =
	env.NODE_ENV === "development"
		? [
				{ level: "query" as const, emit: "stdout" as const },
				{ level: "error" as const, emit: "stdout" as const },
				{ level: "warn" as const, emit: "stdout" as const },
			]
		: [
				{ level: "error" as const, emit: "stdout" as const },
				{ level: "warn" as const, emit: "stdout" as const },
			];

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		adapter,
		log: logConfig,
	});

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}
