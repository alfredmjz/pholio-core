import { cookies } from "next/headers";
import { DEMO_COOKIE } from "@/lib/demo-mode";

/**
 * Whether the current request is running in demo mode.
 *
 * Demo mode lets an unauthenticated visitor explore the app with prefilled
 * data without creating an account. It is enabled by the `pholio_demo` cookie
 * (set by the "Try the demo" entry point) and shares the sample-data layer
 * with the build-time `NEXT_PUBLIC_USE_SAMPLE_DATA` flag.
 */
export async function isDemoMode(): Promise<boolean> {
	const cookieStore = await cookies();
	return cookieStore.get(DEMO_COOKIE)?.value === "1";
}

/**
 * Whether the current request should be served sample data rather than live
 * Supabase data. True when either demo mode is active or the build-time
 * sample-data flag is set.
 */
export async function isSampleDataMode(): Promise<boolean> {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") return true;
	return isDemoMode();
}
