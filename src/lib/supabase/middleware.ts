import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Wraps a promise with a timeout to prevent indefinite hanging.
 * This is a known workaround for Supabase auth.getUser() hanging in Next.js middleware.
 * @see https://github.com/supabase/supabase/issues/35754
 * @see https://github.com/orgs/supabase/discussions/20905
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
	const timeout = new Promise<null>((resolve) => {
		setTimeout(() => resolve(null), ms);
	});
	return Promise.race([promise, timeout]);
}

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
					supabaseResponse = NextResponse.next({
						request,
					});
					cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
				},
			},
		}
	);

	// IMPORTANT: Refresh auth session with timeout to prevent hanging
	// Known issue: auth.getUser() can hang indefinitely in Next.js middleware
	// Timeout ensures middleware doesn't block forever - auth will still be
	// verified in Server Components via requireAuth()
	// @see https://github.com/supabase/supabase/issues/35754
	const result = await withTimeout(supabase.auth.getUser(), 3000);

	if (result === null) {
		console.warn("[Middleware] auth.getUser() timed out after 3s - continuing without refresh");
	}

	// IMPORTANT: You *must* return the supabaseResponse object as it is.
	// If you're creating a new response object with NextResponse.next() make sure to:
	// 1. Pass the request in it, like so:
	//    const myNewResponse = NextResponse.next({ request })
	// 2. Copy over the cookies, like so:
	//    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
	// 3. Change the myNewResponse object to fit your needs, but avoid changing
	//    the cookies!
	// 4. Finally:
	//    return myNewResponse
	// If this is not done, you may be causing the browser and server to go out
	// of sync and terminate the user's session prematurely!

	return supabaseResponse;
}
