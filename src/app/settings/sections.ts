/** Settings groups in page order; the jump list and the old sub-page redirects use these ids. */
export const SETTINGS_SECTIONS = [
	{ id: "profile", label: "Profile" },
	{ id: "sign-in", label: "Sign-in" },
	{ id: "appearance", label: "Appearance" },
	{ id: "budgeting", label: "Budgeting" },
	{ id: "contribution-room", label: "Contribution room" },
	{ id: "presets", label: "Presets" },
	{ id: "region", label: "Region" },
	{ id: "notifications", label: "Notifications" },
	{ id: "data", label: "Your data" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];
