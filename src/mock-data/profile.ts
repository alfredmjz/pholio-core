export const sampleProfile = {
	id: "user-1",
	full_name: "Demo User",
	is_guest: false,
	guest_name: null,
	has_seen_welcome: true,
	avatar_url: null,
	email: "demo@example.com",
	allocation_new_month_default: "dialog" as const,
	default_expected_income: 0,
	created_at: new Date().toISOString(),
	updated_at: new Date().toISOString(),
};
