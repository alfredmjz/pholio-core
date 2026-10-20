import React from "react";
import type { Metadata, Viewport } from "next";

import "@/styles/globals.css";
import "sonner/dist/styles.css";
import LayoutWrapper from "@/components/layoutWrapper";
import { SideBarComponent } from "@/components/sidebar/index";
import { getUserProfile } from "@/lib/getUserProfile";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
	title: "Pholio",
	icons: {
		icon: "/pholio-icon.svg",
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#282624" },
	],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const userProfile = await getUserProfile();

	return (
		<html lang="en" suppressHydrationWarning>
			<body className="flex h-dvh w-full flex-row overflow-hidden bg-background">
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
					<TooltipProvider>
						<LayoutWrapper sidebar={<SideBarComponent userProfile={userProfile} />} userProfile={userProfile}>
							{children}
						</LayoutWrapper>
						<Toaster />
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
