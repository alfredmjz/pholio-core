"use client";

import * as React from "react";
import type { UserProfile } from "@/lib/getUserProfile";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarNavigation } from "./SidebarNavigation";
import { SidebarFooter } from "./SidebarFooter";
import { UserProfileMenu } from "./UserProfileMenu";
import { signOut } from "@/app/(auth-pages)/login/actions";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface SideBarComponentProps {
	userProfile: UserProfile | null;
}

export function SideBarComponent({ userProfile }: SideBarComponentProps) {
	const [isCollapsed, setIsCollapsed] = React.useState(false);
	const router = useRouter();

	const handleSignOut = React.useCallback(async () => {
		await signOut();
		router.push("/login");
	}, [router]);

	const handleToggleCollapse = React.useCallback(() => {
		setIsCollapsed((prev) => !prev);
	}, []);

	return (
		<aside
			className={cn(
				"flex flex-col bg-background border-r border-border transition-all duration-300 ease-in-out",
				isCollapsed ? "w-16" : "w-64"
			)}
		>
			<SidebarHeader isCollapsed={isCollapsed} onToggleCollapse={handleToggleCollapse} />
			<SidebarNavigation isCollapsed={isCollapsed} />
			<div className="mt-auto">
				<UserProfileMenu userProfile={userProfile} onSignOut={handleSignOut} isCollapsed={isCollapsed} />
				<SidebarFooter isCollapsed={isCollapsed} />
			</div>
		</aside>
	);
}
