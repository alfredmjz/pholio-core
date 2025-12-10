import React from "react";
import type { Metadata } from "next";

import "@/styles/globals.css";
import LayoutWrapper from "@/components/layoutWrapper";
import { SidebarWrapper } from "@/components/sidebarWrapper";

export const metadata: Metadata = {
	title: "Pholio",
	icons: {
		icon: "/pholio-icon.svg",
	},
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const sidebar = await SidebarWrapper();
	const themeScript = `(function() {
		const theme = localStorage.getItem('theme');
		if (theme === 'dark') {
			document.documentElement.classList.add('dark');
		}
	})()`;

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
			</head>
			<body className="w-screen h-screen flex flex-row bg-background overflow-hidden">
				<LayoutWrapper sidebar={sidebar}>{children}</LayoutWrapper>
				<footer>{/* Footer content */}</footer>
			</body>
		</html>
	);
}
