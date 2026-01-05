import React from "react";
import type { Metadata } from "next";

import "@/styles/globals.css";
import "sonner/dist/styles.css";
import LayoutWrapper from "@/components/layoutWrapper";
import { SidebarWrapper } from "@/components/sidebarWrapper";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
	title: "Pholio",
	icons: {
		icon: "/pholio-icon.svg",
	},
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const sidebar = await SidebarWrapper();

	return (
		<html lang="en">
			<body className="w-screen h-screen flex flex-row bg-background overflow-hidden">
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
					<TooltipProvider>
						<LayoutWrapper sidebar={sidebar}>{children}</LayoutWrapper>
						<Toaster />
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
