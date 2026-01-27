import { Elysia } from "elysia";
import { jwtVerify } from "jose";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../lib/env";
import { Errors } from "../lib/errors";

/**
 * Decoded JWT payload from Supabase Auth.
 */
export interface AuthUser {
	id: string; // Supabase user UUID (sub claim)
	email?: string;
	role?: string;
}

/**
 * Verify a Supabase JWT using the JWT secret.
 * Returns the decoded user or throws.
 */
async function verifyToken(token: string): Promise<AuthUser> {
	if (!env.SUPABASE_JWT_SECRET) {
		throw Errors.serviceUnavailable("Auth (JWT secret not configured)");
	}

	try {
		const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
		const { payload } = await jwtVerify(token, secret, {
			issuer: `${env.SUPABASE_URL}/auth/v1`,
		});

		if (!payload.sub) {
			throw Errors.unauthorized("Invalid token: missing subject");
		}

		return {
			id: payload.sub,
			email: payload.email as string | undefined,
			role: payload.role as string | undefined,
		};
	} catch (error) {
		if (error instanceof Error && error.name === "AppError") {
			throw error;
		}

		// jose errors: JWTExpired, JWTClaimValidationFailed, JWSSignatureVerificationFailed, etc.
		const message =
			error instanceof Error ? error.message : "Token verification failed";
		throw Errors.unauthorized(message);
	}
}

/**
 * Create a per-request Supabase client using the user's JWT.
 * This client respects RLS policies — Postgres enforces row-level access.
 * Use this for all user-facing data queries.
 */
function createUserClient(accessToken: string): SupabaseClient {
	return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
		global: {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		},
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}

/**
 * Extract Bearer token from Authorization header.
 */
function extractBearerToken(header: string | null | undefined): string | null {
	if (!header) return null;
	const parts = header.split(" ");
	if (parts.length !== 2 || parts[0] !== "Bearer") return null;
	return parts[1];
}

/**
 * Auth plugin — derive `user` from the Authorization header.
 *
 * Usage:
 *   .use(authPlugin)
 *   .get("/protected", ({ user }) => { ... })
 *
 * For optional auth (user may be null):
 *   .use(optionalAuthPlugin)
 *   .get("/maybe-auth", ({ user }) => { if (user) { ... } })
 */
export const authPlugin = new Elysia({ name: "auth" }).derive(
	{ as: "scoped" },
	async ({ headers }): Promise<{ user: AuthUser; supabase: SupabaseClient }> => {
		const token = extractBearerToken(headers.authorization);
		if (!token) {
			throw Errors.unauthorized("Missing Authorization header");
		}

		const user = await verifyToken(token);
		const supabase = createUserClient(token);
		return { user, supabase };
	},
);

/**
 * Optional auth — user is null if no token provided,
 * but still validated if present.
 */
export const optionalAuthPlugin = new Elysia({ name: "optional-auth" }).derive(
	{ as: "scoped" },
	async ({
		headers,
	}): Promise<{ user: AuthUser | null; supabase: SupabaseClient | null }> => {
		const token = extractBearerToken(headers.authorization);
		if (!token) {
			return { user: null, supabase: null };
		}

		try {
			const user = await verifyToken(token);
			const supabase = createUserClient(token);
			return { user, supabase };
		} catch {
			return { user: null, supabase: null };
		}
	},
);
