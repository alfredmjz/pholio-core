"use client";

import React from "react";
import { usePathname } from "next/navigation";

interface LayoutWrapperProps {
	children: React.ReactNode;
	sidebar: React.ReactNode;
}

export default function LayoutWrapper({ children, sidebar }: LayoutWrapperProps) {
	const pathname = usePathname();
	const isAuthPage = pathname.includes("/login") || pathname.includes("/signup") || pathname.includes("/confirm");

	return (
		<>
			{!isAuthPage && sidebar}
			<main className="h-screen w-full overflow-y-auto">{children}</main>
		</>
	);
}
