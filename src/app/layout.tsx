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
import { WeatherProvider } from "@/components/providers/weather-provider";
import { FormatProvider } from "@/components/providers/format-provider";
import { NotificationsProvider } from "@/components/notifications/notifications-provider";
import { getFinancialWeather } from "@/lib/actions/weather-actions";
import { BACKDROP_COOKIE, parseBackdropPreference } from "@/lib/backdrop-preference";
import { toFormatSettings } from "@/lib/format";
import { getUnreadNotifications } from "@/lib/notifications.server";
import { cookies } from "next/headers";

export const metadata: Metadata = {
	title: "Pholio",
	icons: {
		icon: "/pholio-icon.svg",
		apple: "/pholio-icon.png",
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
	const backdrop = parseBackdropPreference((await cookies()).get(BACKDROP_COOKIE)?.value);
	// Not awaited: the page renders while the weather is worked out, and only when it will be shown.
	const weather = userProfile && backdrop === "adaptive" ? getFinancialWeather() : Promise.resolve(null);
	const unread = await getUnreadNotifications(userProfile);

	return (
		<html lang="en" suppressHydrationWarning>
			<body className="flex h-dvh w-full flex-row overflow-hidden bg-background">
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
					<TooltipProvider>
						<FormatProvider settings={toFormatSettings(userProfile?.locale, userProfile?.default_currency)}>
							<WeatherProvider weather={weather} backdrop={backdrop}>
								<NotificationsProvider
									unread={unread}
									changelogSeenAt={userProfile?.changelog_seen_at ?? null}
									signedUpAt={userProfile?.created_at ?? ""}
									inAppEnabled={userProfile?.notify_in_app ?? true}
								>
									<LayoutWrapper sidebar={<SideBarComponent userProfile={userProfile} />} userProfile={userProfile}>
										{children}
									</LayoutWrapper>
								</NotificationsProvider>
							</WeatherProvider>
						</FormatProvider>
						<Toaster />
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
