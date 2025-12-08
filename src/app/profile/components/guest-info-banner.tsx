"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuestConvertDialog } from "@/components/guest-convert-dialog";

/**
 * GuestInfoBanner Component
 *
 * Displays an informational banner for guest users on the profile page,
 * indicating that the profile is view-only and offering an upgrade option.
 *
 * Features:
 * - Blue informational styling using the design system colors
 * - Clear messaging about guest account limitations
 * - Prominent upgrade button that triggers GuestConvertDialog
 * - Responsive layout (stacks on mobile)
 * - Accessible with proper ARIA labels
 *
 * Design:
 * - Background: 10% opacity blue (bg-informational/10)
 * - Border: 4px left border in informational blue
 * - Layout: Flexbox with icon, message, and button
 *
 * @example
 * ```tsx
 * {profile?.is_guest && <GuestInfoBanner />}
 * ```
 */
export function GuestInfoBanner() {
	return (
		<div
			className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg bg-info-muted border-l-4 border-info"
			role="alert"
			aria-live="polite"
		>
			{/* Icon */}
			<div className="flex-shrink-0">
				<AlertCircle className="w-5 h-5 text-info" aria-hidden="true" />
			</div>

			{/* Message */}
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-foreground">Guest Account - View Only</p>
				<p className="text-sm text-muted-foreground mt-0.5">Create a full account to customize your information.</p>
			</div>

			{/* Upgrade Button */}
			<div className="flex-shrink-0 w-full sm:w-auto">
				<GuestConvertDialog>
					<Button variant="outline" className="w-full sm:w-auto border-info text-info hover:bg-info-muted">
						Upgrade Account
					</Button>
				</GuestConvertDialog>
			</div>
		</div>
	);
}
