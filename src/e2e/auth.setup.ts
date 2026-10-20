import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadLocalSupabase } from "./support/local-supabase";

const AUTH_FILE = "e2e/.auth/user.json";

/**
 * Signs in a fresh user through the app's own `/confirm` route and saves the browser state.
 *
 * The link is generated with the local service key instead of being emailed, so the run is
 * fast and never hits the local email rate limit. A new user per run means no database reset
 * is needed between runs. The real email path is covered by e2e/full/magic-link.spec.ts.
 */
setup("sign in with a magic link", async ({ page }) => {
	const supabase = loadLocalSupabase();
	const admin = createClient(supabase.url, supabase.secretKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});

	const email = `e2e-${Date.now()}@pholio.test`;
	const created = await admin.auth.admin.createUser({ email, email_confirm: true });
	expect(created.error, created.error?.message).toBeNull();

	const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
	expect(error, error?.message).toBeNull();

	const tokenHash = data.properties!.hashed_token;
	await page.goto(`/confirm?token_hash=${tokenHash}&type=magiclink&next=/dashboard`);

	// First sign-in shows the welcome celebration; later visits go straight to the dashboard.
	await expect(page).toHaveURL(/\/dashboard\?welcome=true/);
	await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();

	await page.context().storageState({ path: AUTH_FILE });
});
