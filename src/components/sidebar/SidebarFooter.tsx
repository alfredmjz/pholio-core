"use client";

import type { UserProfile } from "@/lib/getUserProfile";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserProfileMenu } from "./UserProfileMenu";

interface SidebarFooterProps {
	isCollapsed: boolean;
	userProfile: UserProfile | null;
	onSignOut: () => void;
}

/** Notifications and the signed-in person, pinned to the bottom; settings, theme and sign-out live in their menu. */
export function SidebarFooter({ isCollapsed, userProfile, onSignOut }: SidebarFooterProps) {
	return (
		<div className="flex flex-col gap-2 px-3 pb-4 pt-3">
			<NotificationBell variant="row" isCollapsed={isCollapsed} />
			<UserProfileMenu userProfile={userProfile} onSignOut={onSignOut} isCollapsed={isCollapsed} variant="row" />
		</div>
	);
}
