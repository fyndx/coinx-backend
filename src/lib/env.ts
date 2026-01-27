import "dotenv/config";

function requireEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

function optionalEnv(key: string, defaultValue: string): string {
	return process.env[key] ?? defaultValue;
}

export const env = {
	// Server
	PORT: Number.parseInt(optionalEnv("PORT", "3000")),
	NODE_ENV: optionalEnv("NODE_ENV", "development"),

	// Database
	DATABASE_URL: requireEnv("DATABASE_URL"),

	// Supabase
	SUPABASE_URL: process.env.SUPABASE_URL ?? "",
	SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "",
	SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
	SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET ?? "",
} as const;
