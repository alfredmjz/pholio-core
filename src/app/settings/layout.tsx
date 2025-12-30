import { type ReactNode } from "react";
import { SettingsNav, SettingsNavMobile } from "./components/settings-nav";
import { PlaceholderBanner } from "./components/placeholder-banner";

/**
 * Profile Layout Component
 *
 * Creates an integrated two-column layout matching Claude.ai design:
 * - Desktop (≥1024px): Vertical nav menu + content side-by-side
 * - Mobile/Tablet (<1024px): Horizontal tabs + full-width content
 *
 * Layout Structure:
 * - App sidebar (from root layout) auto-collapses on mobile/tablet
 * - Settings navigation is integrated into page content (not app chrome)
 * - Content area has max-width constraint for readability
 *
 * Responsive Behavior:
 * - Mobile/Tablet (<1024px): Horizontal scrollable tabs at top, content below
 * - Desktop (≥1024px): Vertical nav (200px) + content in flex layout
 *
 * @param props - React children (nested pages like /profile, /profile/security)
 */
export default function ProfileLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-col items-center w-full min-h-screen">
			{/* Mobile/Tablet Navigation - Horizontal tabs */}
			<div className="w-full">
				<SettingsNavMobile />
			</div>

			{/* Desktop Layout - Two-column */}
			<div className="flex-1 w-full max-w-6xl lg:flex lg:gap-8 md:px-6 lg:px-8 pt-6 pb-12">
				{/* Settings Navigation - Vertical sidebar on desktop */}
				<SettingsNav />

				{/* Main Content Area */}
				<main className="flex-1 min-w-0">
					{/* Banner is now inside content area so it centers relative to content, not viewport */}
					<PlaceholderBanner />
					{children}
				</main>
			</div>
		</div>
	);
}
