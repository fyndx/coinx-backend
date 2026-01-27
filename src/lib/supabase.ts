import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Supabase Admin Client — uses service role key.
 * Has full access, bypasses RLS. Use only on the server.
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
