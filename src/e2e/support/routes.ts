/**
 * Every signed-in page. The layout smoke test visits each one on every device, so add new
 * routes here. Account detail needs an account id and is covered by balance-sheet.spec.ts.
 */
export const APP_ROUTES = [
	"/dashboard",
	"/allocations",
	"/recurring",
	"/balancesheet",
	"/settings",
	"/settings/profile",
	"/settings/preferences",
	"/settings/security",
	"/settings/data-privacy",
] as const;

/** Destinations in the bottom tab bar (mobile) and sidebar (desktop). */
export const NAV_DESTINATIONS = [
	{ label: "Dashboard", path: "/dashboard" },
	{ label: "Allocations", path: "/allocations" },
	{ label: "Recurring", path: "/recurring" },
	{ label: "Balance Sheet", path: "/balancesheet" },
] as const;
