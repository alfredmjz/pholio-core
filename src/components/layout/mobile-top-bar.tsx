"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/(auth-pages)/login/actions";
import { PholioMark } from "@/components/common/pholio-mark";
import { clearDemoModeCookie } from "@/lib/demo-mode";
import { UserProfileMenu } from "@/components/sidebar/UserProfileMenu";
import type { UserProfile } from "@/lib/getUserProfile";

interface MobileTopBarProps {
	userProfile: UserProfile | null;
}

/**
 * Phone-only top bar: the wordmark on the left, the account menu on the right.
 * Uses the same profile menu as the desktop sidebar so settings and sign-out are
 * reachable on every surface.
 */
export function MobileTopBar({ userProfile }: MobileTopBarProps) {
	const router = useRouter();

	const handleSignOut = async () => {
		localStorage.removeItem("sidebarWidth");
		localStorage.removeItem("sidebarCollapsed");
		clearDemoModeCookie();
		await signOut();
		router.push("/login");
	};

	return (
		<header
			className="flex items-center justify-between border-b border-border bg-background px-4 lg:hidden"
			style={{ paddingTop: "env(safe-area-inset-top)" }}
		>
			<div className="flex min-h-14 items-center">
				<Link href="/dashboard" className="flex items-center gap-2" aria-label="Pholio dashboard">
					<PholioMark size={22} />
					<span className="text-[17px] font-semibold tracking-[-0.01em] text-primary">Pholio</span>
				</Link>
			</div>
			<UserProfileMenu
				userProfile={userProfile}
				onSignOut={handleSignOut}
				isCollapsed
				menuSide="bottom"
				menuAlign="end"
			/>
		</header>
	);
}
