import { cookies, headers } from "next/headers";
import { DEMO_HEADER } from "@/lib/demo-mode";
import { DEMO_SESSION_COOKIE, isValidDemoSession } from "@/lib/demo-session";

/**
 * Whether the current request is running in demo mode.
 *
 * Demo access is button-gated: the middleware sets DEMO_HEADER when a request
 * carries the signed httpOnly session issued by `startDemo`. The session itself
 * is also accepted as a fallback (e.g. for server actions invoked from a demo
 * page).
 */
export async function isDemoMode(): Promise<boolean> {
	const headerStore = await headers();
	if (headerStore.get(DEMO_HEADER) === "1") return true;

	const cookieStore = await cookies();
	return isValidDemoSession(cookieStore.get(DEMO_SESSION_COOKIE)?.value);
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
