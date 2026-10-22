"use client";

import type { UserProfile } from "@/lib/getUserProfile";
import { UserProfileMenu } from "./UserProfileMenu";

interface SidebarFooterProps {
	isCollapsed: boolean;
	userProfile: UserProfile | null;
	onSignOut: () => void;
}

/** The signed-in person, pinned to the bottom; settings, theme and sign-out live in their menu. */
export function SidebarFooter({ isCollapsed, userProfile, onSignOut }: SidebarFooterProps) {
	return (
		<div className="px-3 pb-4 pt-3">
			<UserProfileMenu userProfile={userProfile} onSignOut={onSignOut} isCollapsed={isCollapsed} variant="row" />
		</div>
	);
}
