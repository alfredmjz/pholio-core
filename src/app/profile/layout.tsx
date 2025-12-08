import { SettingsNav, SettingsNavMobile } from "./components/settings-nav";

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
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="w-full min-h-screen">
			{/* Mobile/Tablet Navigation - Horizontal tabs */}
			<SettingsNavMobile />

			{/* Desktop Layout - Two-column */}
			<div className="lg:flex lg:gap-8 max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8">
				{/* Settings Navigation - Vertical sidebar on desktop */}
				<SettingsNav />

				{/* Main Content Area */}
				<main className="flex-1 min-w-0">{children}</main>
			</div>
		</div>
	);
}
