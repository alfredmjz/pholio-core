import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/*
 * Server Components can't write cookies, this refresh expired Auth tokens and store them
 */
export async function middleware(request: NextRequest) {
	// Skip auth session update if using sample data to avoid fetch errors when offline/unconfigured
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return NextResponse.next({ request });
	}

	const result = await updateSession(request);
	return result;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * Feel free to modify this pattern to include more paths.
		 */
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
