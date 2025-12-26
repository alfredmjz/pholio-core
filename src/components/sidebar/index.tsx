"use client";

import * as React from "react";
import type { UserProfile } from "@/lib/getUserProfile";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarNavigation } from "./SidebarNavigation";
import { SidebarFooter } from "./SidebarFooter";
import { signOut } from "@/app/(auth-pages)/login/actions";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface SideBarComponentProps {
	userProfile: UserProfile | null;
}

const SIDEBAR_DEFAULTS = {
	WIDTH: 14,
	MIN_WIDTH: 12.5,
	COLLAPSED_WIDTH: 4,
	MAX_WIDTH_PERCENTAGE: 0.25,
	REM_TO_PX: 16,
	MIN_WIDTH_CALC_DELAY: 100,
} as const;

export function SideBarComponent({ userProfile }: SideBarComponentProps) {
	const router = useRouter();
	const [sidebarWidth, setSidebarWidth] = React.useState<number>(SIDEBAR_DEFAULTS.WIDTH);
	const [minWidth, setMinWidth] = React.useState<number>(SIDEBAR_DEFAULTS.WIDTH);
	const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);

	const contentRef = React.useRef<HTMLDivElement>(null);
	const sidebarWidthRef = React.useRef<number>(SIDEBAR_DEFAULTS.WIDTH);

	// Auto-collapse sidebar on mobile/tablet screens
	React.useEffect(() => {
		const handleResize = () => {
			const isSmallScreen = window.innerWidth < 1024; // lg breakpoint
			if (isSmallScreen && !isCollapsed) {
				setIsCollapsed(true);
			}
		};

		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [isCollapsed]);

	// Load saved sidebar width and collapsed state from localStorage
	React.useEffect(() => {
		const savedWidth = localStorage.getItem("sidebarWidth");
		const savedCollapsed = localStorage.getItem("sidebarCollapsed");

		if (savedWidth) {
			const width = parseFloat(savedWidth);
			setSidebarWidth(width);
			sidebarWidthRef.current = width;
		}
		if (savedCollapsed && window.innerWidth >= 1024) {
			setIsCollapsed(savedCollapsed === "true");
		}
	}, []);

	// Keep ref in sync with state
	React.useEffect(() => {
		sidebarWidthRef.current = sidebarWidth;
	}, [sidebarWidth]);

	// Calculate minimum width based on content
	React.useEffect(() => {
		if (!contentRef.current || isCollapsed) return;

		const timeoutId = setTimeout(() => {
			const navList = contentRef.current?.querySelector("nav");
			if (!navList) return;

			const totalWidthPx = navList.scrollWidth;
			const calculatedMinWidth = Math.ceil(totalWidthPx / SIDEBAR_DEFAULTS.REM_TO_PX);
			const finalMinWidth = Math.max(SIDEBAR_DEFAULTS.MIN_WIDTH, calculatedMinWidth);

			setMinWidth(finalMinWidth);

			if (sidebarWidth < finalMinWidth) {
				setSidebarWidth(finalMinWidth);
				localStorage.setItem("sidebarWidth", finalMinWidth.toString());
			}
		}, SIDEBAR_DEFAULTS.MIN_WIDTH_CALC_DELAY);

		return () => clearTimeout(timeoutId);
	}, [isCollapsed, sidebarWidth]);

	const handleSignOut = React.useCallback(async () => {
		localStorage.removeItem("sidebarWidth");
		localStorage.removeItem("sidebarCollapsed");
		await signOut();
		router.push("/login");
	}, [router]);

	const handleToggleCollapse = React.useCallback(() => {
		const newCollapsed = !isCollapsed;
		setIsCollapsed(newCollapsed);
		localStorage.setItem("sidebarCollapsed", newCollapsed.toString());

		if (!newCollapsed && sidebarWidth < minWidth) {
			setSidebarWidth(minWidth);
			localStorage.setItem("sidebarWidth", minWidth.toString());
		}
	}, [isCollapsed, sidebarWidth, minWidth]);

	const handleMouseDown = React.useCallback(
		(e: React.MouseEvent) => {
			if (isCollapsed) return;

			document.body.classList.add("select-none");

			const startX = e.clientX;
			const startWidth = sidebarWidth;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const maxWidth = (window.innerWidth * SIDEBAR_DEFAULTS.MAX_WIDTH_PERCENTAGE) / SIDEBAR_DEFAULTS.REM_TO_PX;
				const delta = (moveEvent.clientX - startX) / SIDEBAR_DEFAULTS.REM_TO_PX;
				const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
				setSidebarWidth(newWidth);
			};

			const handleMouseUp = () => {
				document.body.classList.remove("select-none");
				localStorage.setItem("sidebarWidth", sidebarWidthRef.current.toString());
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		},
		[isCollapsed, sidebarWidth, minWidth]
	);

	return (
		<aside
			ref={contentRef}
			className="relative flex flex-col bg-background border-r border-border h-screen shrink-0"
			style={{ width: isCollapsed ? `${SIDEBAR_DEFAULTS.COLLAPSED_WIDTH}rem` : `${sidebarWidth}rem` }}
		>
			<SidebarHeader
				isCollapsed={isCollapsed}
				onToggleCollapse={handleToggleCollapse}
				userProfile={userProfile}
				onSignOut={handleSignOut}
			/>
			<SidebarNavigation isCollapsed={isCollapsed} />
			<div className="mt-auto">
				<SidebarFooter isCollapsed={isCollapsed} />
			</div>

			{/* Resize Handle */}
			{!isCollapsed && (
				<div
					className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-border transition-colors"
					onMouseDown={handleMouseDown}
				/>
			)}
		</aside>
	);
}
