"use client";

import { useState, useEffect } from "react";
import { Info } from "lucide-react";
import { Banner, BannerClose, BannerIcon, BannerTitle } from "@/components/ui/banner";

export function PlaceholderBanner() {
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		// Check if banner was previously dismissed
		const dismissed = localStorage.getItem("pholio-settings-placeholder-dismissed");
		if (!dismissed) {
			setIsVisible(true);
		}
	}, []);

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setIsVisible(false);
			localStorage.setItem("pholio-settings-placeholder-dismissed", "true");
		} else {
			setIsVisible(true);
		}
	};

	// We control the visibility via the `open` prop
	return (
		<div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4 pointer-events-none">
			<div className="pointer-events-auto">
				<Banner
					open={isVisible}
					onOpenChange={handleOpenChange}
					className="bg-foreground text-background shadow-lg rounded-full py-2 pl-4 pr-2 border-none"
				>
					<BannerIcon icon={Info} className="text-background/80" />
					<BannerTitle className="text-background">
						<span className="font-semibold">Note:</span> MFA, Active Sessions, Regional Settings, Notifications and Data & Privacy are placeholders.
					</BannerTitle>
					<BannerClose className="text-background/70 hover:bg-background/20 hover:text-background rounded-full" />
				</Banner>
			</div>
		</div>
	);
}
