import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { expect } from "@/e2e/fixtures";
import { loadLocalSupabase } from "@/e2e/support/local-supabase";

export function adminClient() {
	const supabase = loadLocalSupabase();
	return createClient(supabase.url, supabase.secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Signs in a brand-new user, for tests that change account-wide state. Use it with
 * `test.use({ storageState: SIGNED_OUT })`. Each attempt gets its own user, so a retry starts clean.
 */
export async function signInNewUser(page: Page, label: string) {
	const admin = adminClient();
	const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pholio.test`;
	const created = await admin.auth.admin.createUser({ email, email_confirm: true });
	expect(created.error, created.error?.message).toBeNull();
	const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
	expect(error, error?.message).toBeNull();
	await page.goto(`/confirm?token_hash=${data.properties!.hashed_token}&type=magiclink&next=/dashboard`);
	// A new account names itself first.
	await expect(page).toHaveURL(/\/welcome$/);
	await page.getByLabel("Your name").fill(`E2E ${label}`);
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
	return created.data.user!.id;
}
