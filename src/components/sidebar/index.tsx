"use client";

import * as React from "react";
import type { UserProfile } from "@/lib/getUserProfile";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarNavigation } from "./SidebarNavigation";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarResizeHandle } from "./sidebar-resize-handle";
import { signOut } from "@/app/(auth-pages)/login/actions";
import { useRouter } from "next/navigation";
import { clearDemoModeCookie } from "@/lib/demo-mode";
import { cn } from "@/lib/utils";

interface SideBarComponentProps {
	userProfile: UserProfile | null;
}

const SIDEBAR_DEFAULTS = {
	WIDTH: 14,
	MIN_WIDTH: 12.5,
	COLLAPSED_WIDTH: 4,
	MAX_WIDTH_PERCENTAGE: 0.3,
	REM_TO_PX: 16,
} as const;

export function SideBarComponent({ userProfile }: SideBarComponentProps) {
	const router = useRouter();
	const [sidebarWidth, setSidebarWidth] = React.useState<number>(SIDEBAR_DEFAULTS.WIDTH);
	const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);
	const [isResizing, setIsResizing] = React.useState(false);
	const [maxWidth, setMaxWidth] = React.useState<number>(SIDEBAR_DEFAULTS.WIDTH * 1.5);

	const contentRef = React.useRef<HTMLDivElement>(null);
	// The width mid-drag. A re-render during a drag (the labels fading) must keep it, not jump back
	// to the saved width for a frame.
	const liveRemRef = React.useRef<number | null>(null);

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
			if (Number.isFinite(width)) setSidebarWidth(Math.max(SIDEBAR_DEFAULTS.MIN_WIDTH, width));
		}
		if (savedCollapsed && window.innerWidth >= 1024) {
			setIsCollapsed(savedCollapsed === "true");
		}
	}, []);

	const handleSignOut = React.useCallback(async () => {
		localStorage.removeItem("sidebarWidth");
		localStorage.removeItem("sidebarCollapsed");
		clearDemoModeCookie();
		await signOut();
		router.push("/login");
	}, [router]);

	// The widest the sidebar may be: 30% of the window, never less than its minimum.
	React.useEffect(() => {
		const update = () =>
			setMaxWidth(
				Math.max(
					SIDEBAR_DEFAULTS.MIN_WIDTH,
					(window.innerWidth * SIDEBAR_DEFAULTS.MAX_WIDTH_PERCENTAGE) / SIDEBAR_DEFAULTS.REM_TO_PX
				)
			);
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);

	const handleResizeCommit = React.useCallback(
		({ widthRem, isCollapsed: collapsed }: { widthRem: number; isCollapsed: boolean }) => {
			setIsCollapsed(collapsed);
			localStorage.setItem("sidebarCollapsed", collapsed.toString());
			if (!collapsed) {
				setSidebarWidth(widthRem);
				localStorage.setItem("sidebarWidth", widthRem.toString());
			}
		},
		[]
	);

	return (
		<aside
			ref={contentRef}
			// Transparent and above the page, so a redesigned page's backdrop lines run under it.
			className={cn(
				"group/sidebar relative z-20 hidden h-dvh shrink-0 flex-col bg-transparent lg:flex",
				// Width eases when a drag is let go (snapping to the rail or the minimum) and on reset; during
				// a drag the handle writes it directly every frame, so no transition then.
				!isResizing && "transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
			)}
			style={{
				width:
					isResizing && liveRemRef.current !== null
						? `${liveRemRef.current}rem`
						: isCollapsed
							? `${SIDEBAR_DEFAULTS.COLLAPSED_WIDTH}rem`
							: `${sidebarWidth}rem`,
			}}
		>
			<SidebarHeader isCollapsed={isCollapsed} />
			<SidebarNavigation isCollapsed={isCollapsed} />
			<div className="mt-auto">
				<SidebarFooter isCollapsed={isCollapsed} userProfile={userProfile} onSignOut={handleSignOut} />
			</div>

			<SidebarResizeHandle
				targetRef={contentRef}
				widthRem={sidebarWidth}
				isCollapsed={isCollapsed}
				minRem={SIDEBAR_DEFAULTS.MIN_WIDTH}
				maxRem={maxWidth}
				collapsedRem={SIDEBAR_DEFAULTS.COLLAPSED_WIDTH}
				defaultRem={SIDEBAR_DEFAULTS.WIDTH}
				onDraggingChange={(dragging) => {
					liveRemRef.current = null;
					setIsResizing(dragging);
					document.body.classList.toggle("select-none", dragging);
				}}
				onCollapsedPreview={(collapsed, liveRem) => {
					liveRemRef.current = liveRem;
					setIsCollapsed(collapsed);
				}}
				onCommit={handleResizeCommit}
			/>
		</aside>
	);
}
