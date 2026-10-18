"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isDemoModeActive, clearDemoModeCookie } from "@/lib/demo-mode";
import { endDemo } from "@/app/(auth-pages)/login/actions";
import { isAuthRoute } from "@/lib/routes";

/**
 * Persistent banner shown while the user is exploring in demo mode.
 * Offers a "Sign up to save" CTA that clears demo mode and returns to login.
 */
export function DemoModeBanner() {
	const pathname = usePathname();
	const router = useRouter();
	const [isDemo, setIsDemo] = useState(false);

	useEffect(() => {
		setIsDemo(isDemoModeActive());
	}, [pathname]);

	if (!isDemo || isAuthRoute(pathname)) return null;

	const handleSignUp = async () => {
		await endDemo();
		clearDemoModeCookie();
		router.push("/login");
	};

	return (
		<div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 text-foreground">
			<p className="text-xs sm:text-sm">You're exploring the demo — your changes aren't saved.</p>
			<Button size="sm" onClick={handleSignUp}>
				Sign up to save
			</Button>
		</div>
	);
}
