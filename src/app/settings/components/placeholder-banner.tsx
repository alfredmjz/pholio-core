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
	// Use sticky positioning so the banner stays centered within the content area
	// rather than the entire viewport (which ignores the resizable sidebar)
	return (
		<div className="sticky top-0 z-50 w-full flex justify-center pointer-events-none pb-4">
			<div className="pointer-events-auto max-w-3xl w-full px-4">
				<Banner
					open={isVisible}
					onOpenChange={handleOpenChange}
					className="rounded-full border border-border bg-card py-2 pl-4 pr-2 text-foreground shadow-card"
				>
					<BannerIcon icon={Info} className="text-info" />
					<BannerTitle className="text-foreground">
						<span className="font-semibold">Note:</span> MFA, Active Sessions, Regional Settings, Notifications and Data
						& Privacy are placeholders.
					</BannerTitle>
					<BannerClose className="rounded-full text-muted-foreground hover:bg-hover hover:text-foreground" />
				</Banner>
			</div>
		</div>
	);
}
