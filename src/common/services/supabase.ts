import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

/**
 * Supabase Admin Client — uses service role key.
 * Bypasses RLS entirely. Use ONLY for:
 * - Admin operations (analytics, migrations, cleanup)
 * - Operations that span multiple users
 * - Auth management (user lookup, etc.)
 *
 * For user-facing data queries, use the per-request client
 * from authPlugin ({ supabase }) which respects RLS.
 */
export const supabaseAdmin = createClient(
	env.SUPABASE_URL,
	env.SUPABASE_SERVICE_ROLE_KEY,
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	},
);
