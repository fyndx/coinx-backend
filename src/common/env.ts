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

	// Supabase (required in production, optional in dev)
	SUPABASE_URL: optionalEnv("SUPABASE_URL", ""),
	SUPABASE_ANON_KEY: optionalEnv("SUPABASE_ANON_KEY", ""),
	SUPABASE_SERVICE_ROLE_KEY: optionalEnv("SUPABASE_SERVICE_ROLE_KEY", ""),
	SUPABASE_JWT_SECRET: optionalEnv("SUPABASE_JWT_SECRET", ""),

	// Error Tracking (Better Stack via Sentry SDK)
	SENTRY_DSN: optionalEnv(
		"SENTRY_DSN",
		"",
	),

	// Log Management (Better Stack)
	BETTERSTACK_SOURCE_TOKEN: optionalEnv("BETTERSTACK_SOURCE_TOKEN", ""),
} as const;
