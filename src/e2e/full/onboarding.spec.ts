import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { test, expect, SIGNED_OUT } from "@/e2e/fixtures";
import { loadLocalSupabase } from "@/e2e/support/local-supabase";

test.use({ storageState: SIGNED_OUT });

function adminClient() {
	const supabase = loadLocalSupabase();
	return createClient(supabase.url, supabase.secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Creates a user and opens their sign-in link; `next` is where the link says to go. */
async function signIn(page: Page, label: string, next = "/dashboard") {
	const admin = adminClient();
	const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pholio.test`;
	const created = await admin.auth.admin.createUser({ email, email_confirm: true });
	expect(created.error, created.error?.message).toBeNull();
	const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
	expect(error, error?.message).toBeNull();
	await page.goto(
		`/confirm?token_hash=${data.properties!.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`
	);
	return created.data.user!.id;
}

test("a new account names itself once, then goes where the link pointed", async ({ page }) => {
	const userId = await signIn(page, "onboard", "/recurring");
	await expect(page).toHaveURL(/\/welcome\?next=%2Frecurring$/);
	await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();

	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page.locator("#name-error")).toHaveText("Enter your name");

	await page.getByLabel("Your name").fill("  Alex Rivera  ");
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page).toHaveURL(/\/recurring$/, { timeout: 20_000 });

	const { data: profile } = await adminClient().from("users").select("full_name, timezone").eq("id", userId).single();
	expect(profile?.full_name).toBe("Alex Rivera");
	// The browser's own time zone, saved without asking.
	expect(profile?.timezone).toBeTruthy();

	// Done once: the page sends them on.
	await page.goto("/welcome");
	await expect(page).toHaveURL(/\/dashboard$/);
	// The greeting uses the first name.
	await expect(page.getByText(/, Alex$/)).toBeVisible();
});

test("an existing account without a name is asked before the dashboard", async ({ page }) => {
	const userId = await signIn(page, "nameless");
	await page.getByLabel("Your name").fill("Sam");
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });

	await adminClient().from("users").update({ full_name: null }).eq("id", userId);
	await page.goto("/dashboard");
	await expect(page).toHaveURL(/\/welcome$/);
});

test("a sign-in link can't send someone to another site", async ({ page }) => {
	await signIn(page, "offsite", "https://example.com/phish");
	await expect(page).toHaveURL(/\/welcome$/);
});
