"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { isAuthRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { UserProfile } from "@/lib/getUserProfile";

interface LayoutWrapperProps {
	children: React.ReactNode;
	sidebar: React.ReactNode;
	userProfile: UserProfile | null;
}

export default function LayoutWrapper({ children, sidebar, userProfile }: LayoutWrapperProps) {
	const pathname = usePathname();
	const isAuthPage = isAuthRoute(pathname);

	return (
		<>
			{!isAuthPage && sidebar}
			<div className="flex h-dvh min-w-0 flex-1 flex-col">
				{!isAuthPage && <MobileTopBar userProfile={userProfile} />}
				<main className={cn("flex-1 overflow-y-auto", !isAuthPage && "pb-28 lg:pb-0")}>
					<DemoModeBanner />
					{children}
				</main>
				{!isAuthPage && <MobileNav />}
			</div>
		</>
	);
}
