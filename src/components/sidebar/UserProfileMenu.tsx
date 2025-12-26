"use client";

import * as React from "react";
import type { UserProfile } from "@/lib/getUserProfile";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { signOut } from "@/app/(auth-pages)/login/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GuestLogoutAlert } from "@/components/guest-logout-alert";
import { cn } from "@/lib/utils";

interface UserProfileMenuProps {
	userProfile: UserProfile | null;
	onSignOut: () => void;
	isCollapsed: boolean;
}

export function UserProfileMenu({ userProfile, onSignOut, isCollapsed }: UserProfileMenuProps) {
	const router = useRouter();

	const [showGuestLogoutAlert, setShowGuestLogoutAlert] = React.useState(false);

	const displayName = userProfile?.full_name || userProfile?.guest_name || "Guest User";

	const displayInitials = displayName
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	const handleSignOutClick = React.useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			if (userProfile?.is_guest) {
				setShowGuestLogoutAlert(true);
			} else {
				onSignOut();
			}
		},
		[userProfile, onSignOut]
	);

	const performSignOut = React.useCallback(async () => {
		localStorage.removeItem("sidebarWidth");
		localStorage.removeItem("sidebarCollapsed");
		await signOut();
		router.push("/login");
	}, [router]);

	return (
		<>
			{/* User Profile Menu */}
			<NavigationMenu className="px-2 w-full">
				<NavigationMenuItem className="w-full">
					<NavigationMenuTrigger
						className={cn(
							"flex items-center gap-3 p-2 rounded-md w-full h-auto",
							isCollapsed ? "justify-center" : "justify-start"
						)}
					>
						{userProfile?.avatar_url ? (
							<img
								src={userProfile.avatar_url}
								alt={displayName}
								className="w-8 h-8 flex-shrink-0 rounded-md object-cover"
							/>
						) : (
							<div className="w-8 h-8 flex-shrink-0 rounded-md bg-primary flex items-center justify-center text-background text-xs font-semibold">
								{displayInitials}
							</div>
						)}
						{!isCollapsed && (
							<span className="truncate min-w-0 flex-1 text-left text-sm font-medium text-primary">{displayName}</span>
						)}
					</NavigationMenuTrigger>
					<NavigationMenuContent className="flex flex-col gap-1 p-2 w-full">
						<NavigationMenuLink asChild>
							<Link
								href="/settings/profile"
								className="flex items-center w-full px-2 py-1.5 text-sm text-primary rounded-sm hover:bg-accent hover:text-accent transition-colors"
							>
								User Setting
							</Link>
						</NavigationMenuLink>
						<NavigationMenuLink asChild>
							<button
								onClick={handleSignOutClick}
								className="flex items-center w-full px-2 py-1.5 text-sm text-primary rounded-sm hover:bg-accent hover:text-accent transition-colors text-left"
							>
								Sign Out
							</button>
						</NavigationMenuLink>
					</NavigationMenuContent>
				</NavigationMenuItem>
			</NavigationMenu>

			{/* Guest Logout Alert */}
			<GuestLogoutAlert open={showGuestLogoutAlert} onOpenChange={setShowGuestLogoutAlert} onConfirm={performSignOut} />
		</>
	);
}

