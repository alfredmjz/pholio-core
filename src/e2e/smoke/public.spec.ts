import { createClient } from "@supabase/supabase-js";
import { test, expect, expectNoHorizontalScroll, SIGNED_OUT } from "@/e2e/fixtures";
import { loadLocalSupabase } from "@/e2e/support/local-supabase";
import { hashIdentifier, normalizeEmail } from "@/lib/magic-link-limit";

test.use({ storageState: SIGNED_OUT });

/** Removes a test email's recorded sends, so repeated local runs don't use up the per-IP limit. */
async function forgetMagicLinkSends(email: string) {
	const supabase = loadLocalSupabase();
	const admin = createClient(supabase.url, supabase.secretKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
	await admin
		.from("magic_link_sends")
		.delete()
		.eq("email_hash", hashIdentifier(normalizeEmail(email)));
}

test.describe("signed out", { tag: "@smoke" }, () => {
	test("app pages redirect to login", async ({ page }) => {
		await page.goto("/dashboard");
		await expect(page).toHaveURL(/\/login/);
		await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
	});

	test("login page fits the screen and validates the email", async ({ page }) => {
		await page.goto("/login");
		await expectNoHorizontalScroll(page);

		await page.getByLabel("Email").fill("not-an-email");
		await page.getByRole("button", { name: "Email me a link" }).click();
		await expect(page.getByRole("alert").filter({ hasText: "That email address doesn't look right." })).toBeVisible();
	});

	test("after sending a link, resend waits for the server and Back keeps the email", async ({ page }, testInfo) => {
		const email = `e2e-resend-${testInfo.project.name}-${Date.now()}@pholio.test`;
		try {
			await page.goto("/login");
			await page.getByLabel("Email").fill(email);
			await page.getByRole("button", { name: "Email me a link" }).click();

			await expect(page.getByRole("heading", { name: "Check your inbox." })).toBeVisible();
			await expectNoHorizontalScroll(page);
			await expect(page.getByRole("button", { name: /^Resend in \d+:\d{2}$/ })).toBeDisabled();

			await page.getByRole("button", { name: "Back" }).click();
			await expect(page.getByLabel("Email")).toHaveValue(email);

			// Going Back skips the page's countdown, but the server still refuses inside the 60 s gap.
			await page.getByRole("button", { name: "Email me a link" }).click();
			await expect(page.getByText(/Wait \d+ seconds? before asking for another link\./)).toBeVisible();
			await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
		} finally {
			await forgetMagicLinkSends(email);
		}
	});

	test("try the demo opens the dashboard with sample data", async ({ page }) => {
		await page.goto("/login");
		await page.getByRole("button", { name: "Try the demo" }).click();

		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
	});
});
