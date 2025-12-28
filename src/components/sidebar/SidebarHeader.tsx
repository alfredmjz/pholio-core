"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/lib/getUserProfile";
import { UserProfileMenu } from "./UserProfileMenu";

interface SidebarHeaderProps {
	isCollapsed: boolean;
	onToggleCollapse: () => void;
	userProfile: UserProfile | null;
	onSignOut: () => void;
}

export function SidebarHeader({ isCollapsed, onToggleCollapse, userProfile, onSignOut }: SidebarHeaderProps) {
	return (
		<div
			className={cn(
				"hidden lg:flex items-center gap-2 px-4 pt-4 pb-2 relative z-50 overflow-hidden",
				isCollapsed ? "flex-col" : "flex-row"
			)}
		>
			<Button
				onClick={onToggleCollapse}
				variant="ghost"
				size="icon"
				className="flex items-center justify-center w-8 h-8 rounded-md bg-secondary hover:bg-accent hover:text-accent-foreground text-primary flex-shrink-0"
				aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
				title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
			>
				{isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
			</Button>
			<div className={cn("flex-1 min-w-0 overflow-hidden", isCollapsed && "w-full")}>
				<UserProfileMenu userProfile={userProfile} onSignOut={onSignOut} isCollapsed={isCollapsed} />
			</div>
		</div>
	);
}
