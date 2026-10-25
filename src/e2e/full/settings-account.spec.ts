import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { test, expect, SIGNED_OUT } from "@/e2e/fixtures";
import { loadLocalSupabase } from "@/e2e/support/local-supabase";

test.use({ storageState: SIGNED_OUT });

function adminClient() {
	const supabase = loadLocalSupabase();
	return createClient(supabase.url, supabase.secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function choose(page: Page, label: string, option: RegExp) {
	const trigger = page.getByLabel(label);
	await trigger.scrollIntoViewIfNeeded();
	await trigger.click();
	await page.getByRole("option", { name: option }).click();
	await expect(
		page
			.locator("[data-sonner-toast]")
			.filter({ hasText: /^Saved$/ })
			.first()
	).toBeVisible();
}

/** Reopens Settings until the saved value comes back from the server. */
async function expectSaved(page: Page, label: string, text: string) {
	await expect(async () => {
		await page.goto("/settings");
		await expect(page.getByLabel(label)).toContainText(text, { timeout: 2_000 });
	}).toPass({ timeout: 20_000 });
}

/** A user of its own, because these tests change account-wide settings or delete the account. */
async function signInNewUser(page: Page, label: string) {
	const admin = adminClient();
	const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pholio.test`;
	const created = await admin.auth.admin.createUser({ email, email_confirm: true });
	expect(created.error, created.error?.message).toBeNull();
	const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
	expect(error, error?.message).toBeNull();
	await page.goto(`/confirm?token_hash=${data.properties!.hashed_token}&type=magiclink&next=/dashboard`);
	await expect(page).toHaveURL(/\/dashboard/);
	return created.data.user!.id;
}

test("the number format and currency apply across the app", async ({ page }) => {
	await signInNewUser(page, "format");

	await page.goto("/settings#region");
	await choose(page, "Number and date format", /French \(France\)/);
	await expectSaved(page, "Number and date format", "French (France)");

	await choose(page, "Default currency", /^EUR$/);
	await expectSaved(page, "Default currency", "EUR");

	// A new user's net worth is zero, written the French way in euros.
	await page.goto("/dashboard");
	await expect(page.getByText(/^0\s€$/).first()).toBeVisible();
});

test("the bell's dot shows unread reminders and releases until they're seen", async ({ page }) => {
	const userId = await signInNewUser(page, "bell");
	const admin = adminClient();
	// What the daily job would add for a bill due soon, and a user who last looked before the latest release.
	const { error } = await admin.from("notifications").insert({
		user_id: userId,
		kind: "recurring_due",
		ref_id: crypto.randomUUID(),
		due_date: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
		name: "E2E Hydro",
		detail: "Bill",
		amount: 82.4,
	});
	expect(error, error?.message).toBeNull();
	await admin.from("users").update({ changelog_seen_at: "2020-01-01T00:00:00Z" }).eq("id", userId);

	await page.goto("/dashboard");
	const bell = page.getByRole("button", { name: /^Notifications/ }).locator("visible=true");
	await expect(bell).toHaveAccessibleName("Notifications, unread");

	await bell.click();
	const show = page.getByRole("group", { name: "Show" });
	await expect(show.getByRole("radio", { name: "Account, unread" })).toBeVisible();
	await expect(page.getByRole("link", { name: /E2E Hydro/ })).toContainText("Bill, $82.40");
	await show.getByRole("radio", { name: "What's new, unread" }).click();
	await page.keyboard.press("Escape");

	await expect(bell).toHaveAccessibleName("Notifications");
	// Read on the server too, not just in this tab (the save runs in the background).
	await expect(async () => {
		await page.reload();
		await expect(page.getByRole("button", { name: /^Notifications/ }).locator("visible=true")).toHaveAccessibleName(
			"Notifications",
			{ timeout: 2_000 }
		);
	}).toPass({ timeout: 20_000 });

	await page
		.getByRole("button", { name: /^Notifications/ })
		.locator("visible=true")
		.click();
	await page.getByRole("link", { name: /E2E Hydro/ }).click();
	await expect(page).toHaveURL(/\/recurring$/);
});

test("resetting data empties Pholio and keeps the login and settings", async ({ page }) => {
	const userId = await signInNewUser(page, "reset");
	const admin = adminClient();
	const { data: chequing } = await admin
		.from("account_types")
		.select("id")
		.eq("code", "chequing")
		.is("user_id", null)
		.limit(1)
		.single();
	const { error } = await admin
		.from("accounts")
		.insert({ user_id: userId, name: "E2E Reset Chequing", account_type_id: chequing!.id, current_balance: 250 });
	expect(error, error?.message).toBeNull();
	await admin.from("users").update({ full_name: "Reset Tester" }).eq("id", userId);

	await page.goto("/settings#data");
	await page.getByRole("button", { name: "Reset data" }).click();
	const dialog = page.getByRole("alertdialog", { name: "Reset your data?" });
	const confirm = dialog.getByRole("button", { name: "Reset data" });
	await expect(confirm).toBeDisabled();
	await dialog.getByLabel(/Type RESET to confirm/).fill("RESET");
	await confirm.click();

	await expect(page.getByText("Your data was reset")).toBeVisible();
	await expect(page).toHaveURL(/\/dashboard/);

	const { count } = await admin.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", userId);
	expect(count).toBe(0);
	const { data: profile } = await admin.from("users").select("full_name").eq("id", userId).single();
	expect(profile?.full_name).toBe("Reset Tester");
	await page.goto("/settings");
	await expect(page).toHaveURL(/\/settings/);
});

test("deleting the account removes the login and signs out", async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== "desktop", "Creates and deletes a user; once per suite is enough");
	const userId = await signInNewUser(page, "delete");

	await page.goto("/settings#data");
	await page.getByRole("button", { name: "Delete account" }).click();
	const dialog = page.getByRole("alertdialog", { name: "Delete your account?" });
	await dialog.getByLabel(/Type DELETE to confirm/).fill("DELETE");
	await dialog.getByRole("button", { name: "Delete account" }).click();

	await expect(page.getByText("Your account was deleted")).toBeVisible();
	await expect(page).toHaveURL(/\/login/);

	const { data } = await adminClient().auth.admin.getUserById(userId);
	expect(data.user).toBeNull();

	await page.goto("/settings");
	await expect(page).toHaveURL(/\/login/);
});
