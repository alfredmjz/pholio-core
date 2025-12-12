"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { isAuthRoute } from "@/lib/routes";

interface LayoutWrapperProps {
	children: React.ReactNode;
	sidebar: React.ReactNode;
}

export default function LayoutWrapper({ children, sidebar }: LayoutWrapperProps) {
	const pathname = usePathname();
	const isAuthPage = isAuthRoute(pathname);

	return (
		<>
			{!isAuthPage && sidebar}
			<main className="h-screen w-full overflow-y-auto">{children}</main>
		</>
	);
}
