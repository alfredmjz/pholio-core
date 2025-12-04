import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

	// Do not run code between createServerClient and
	// supabase.auth.getUser(). A simple mistake could make it very hard to debug
	// issues with users being randomly logged out.

	// IMPORTANT: DO NOT REMOVE auth.getUser()

	const {
		data: { user },
	} = await supabase.auth.getUser();

	// List of public paths that don't require authentication
	const publicPaths = ['/login', '/auth', '/error', '/signup', '/confirm'];
	const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path));

	// Check if user is authenticated
	if (!user && !isPublicPath) {
		// no user, redirect to login page
		const url = request.nextUrl.clone();
		url.pathname = '/login';
		return NextResponse.redirect(url);
	}

	// If user exists, verify profile exists in database (except for public paths)
	if (user && !isPublicPath) {
		const { data: profile, error: profileError } = await supabase
			.from('users')
			.select('id')
			.eq('id', user.id)
			.single();

		// If profile doesn't exist, sign out and redirect to login
		if (profileError || !profile) {
			console.error('Profile not found for authenticated user, signing out:', profileError);
			await supabase.auth.signOut();
			const url = request.nextUrl.clone();
			url.pathname = '/login';
			return NextResponse.redirect(url);
		}
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
