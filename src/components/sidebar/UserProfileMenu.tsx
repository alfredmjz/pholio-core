"use client";

import * as React from "react";
import type { UserProfile } from "@/lib/getUserProfile";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface UserProfileMenuProps {
	userProfile: UserProfile | null;
	onSignOut: () => void;
	isCollapsed: boolean;
	/** Where the dropdown opens relative to the trigger. Defaults to the sidebar placement. */
	menuSide?: "top" | "right" | "bottom" | "left";
	menuAlign?: "start" | "center" | "end";
}

export function UserProfileMenu({
	userProfile,
	onSignOut,
	isCollapsed,
	menuSide = "right",
	menuAlign = "start",
}: UserProfileMenuProps) {
	const [open, setOpen] = React.useState(false);

	const displayName = userProfile?.full_name || "Pholio User";

	const displayInitials = displayName
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	const handleSignOutClick = React.useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			setOpen(false);
			onSignOut();
		},
		[onSignOut]
	);

	return (
		<>
			{/* User Profile Menu */}
			<DropdownMenu open={open} onOpenChange={setOpen}>
				<DropdownMenuTrigger asChild>
					<div
						className={cn(
							"inline-flex items-center gap-2 p-2 rounded-md h-auto outline-none cursor-pointer max-w-full focus-visible:ring-2 focus-visible:ring-ring",
							isCollapsed ? "justify-center" : "justify-start"
						)}
						aria-label={isCollapsed ? "Account menu" : undefined}
						tabIndex={0}
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
							<>
								<span className="truncate text-left text-sm font-medium text-primary max-w-[120px]">{displayName}</span>
								<ChevronDown
									className={cn(
										"h-3 w-3 flex-shrink-0 transition-transform duration-200 text-primary",
										open && "rotate-180"
									)}
								/>
							</>
						)}
					</div>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					side={menuSide}
					align={menuAlign}
					sideOffset={menuSide === "right" ? -20 : 8}
					alignOffset={menuSide === "right" ? 30 : 0}
					className="border-border border-2 w-40"
				>
					<DropdownMenuItem asChild>
						<Link
							href="/settings/profile"
							className="flex items-center w-full cursor-pointer"
							onClick={() => setOpen(false)}
						>
							User Setting
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={handleSignOutClick} className="cursor-pointer">
						Sign Out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}

