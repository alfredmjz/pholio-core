import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client for server-side operations.
 *
 * Configures cookie handling for authentication in Server Components and Route Handlers.
 *
 * @returns Configured Supabase server client
 *
 * @example
 * ```typescript
 * const supabase = await createClient();
 * const { data: { user } } = await supabase.auth.getUser();
 * ```
 */
export async function createClient() {
	const cookieStore = await cookies();

	return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
		cookies: {
			getAll() {
				return cookieStore.getAll();
			},
			setAll(cookiesToSet) {
				try {
					cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
				} catch (e) {
					// GOTCHA: setAll called from Server Component cannot set cookies
					// This is expected - middleware handles session refresh
				}
			},
		},
	});
}

/**
 * Signed-in user's id for read-only queries. getClaims() verifies the JWT locally against the
 * project's cached signing keys instead of asking Supabase Auth like getUser() does; RLS still
 * guards every row. Keep getUser() for writes and anything security-sensitive.
 */
export async function getReadUserId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
	const { data } = await supabase.auth.getClaims();
	return data?.claims.sub ?? null;
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase Admin client using the Service Role Key.
 * Bypasses Row Level Security (RLS). Use ONLY in secure server contexts (e.g., Cron jobs, Webhooks).
 */
export function createAdminClient() {
	if (!process.env.SUPABASE_SECRET_KEY) {
		throw new Error("Missing SUPABASE_SECRET_KEY environment variable");
	}
	return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}
