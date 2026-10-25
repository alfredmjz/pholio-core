import { test, expect, SIGNED_OUT } from "@/e2e/fixtures";
import { loadLocalSupabase } from "@/e2e/support/local-supabase";

test.use({ storageState: SIGNED_OUT });

type MailpitSummary = { ID: string; To: { Address: string }[] };

/**
 * The real email path: submit the login form, open the link from the local Mailpit inbox.
 * Desktop only, because local Supabase allows two auth emails per hour.
 */
test("sign in with the emailed magic link", async ({ page, baseURL }, testInfo) => {
	test.skip(testInfo.project.name !== "desktop", "Sends a real email; runs once per suite");

	const { mailpitUrl } = loadLocalSupabase();
	const email = `e2e-mail-${Date.now()}@pholio.test`;

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByRole("button", { name: "Email me a link" }).click();
	await expect(page.getByRole("heading", { name: "Check your inbox." })).toBeVisible();

	let messageId = "";
	await expect
		.poll(
			async () => {
				const response = await fetch(`${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
				const { messages } = (await response.json()) as { messages: MailpitSummary[] };
				messageId = messages[0]?.ID ?? "";
				return messageId;
			},
			{ message: "magic link email never arrived", timeout: 15_000 }
		)
		.not.toBe("");

	const message = (await (await fetch(`${mailpitUrl}/api/v1/message/${messageId}`)).json()) as { HTML: string };
	const link = message.HTML.match(/href="([^"]*\/confirm\?token_hash=[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
	expect(link, "sign-in link in the email").toBeTruthy();

	// The link returns to the app that asked for it (redirect_to), not Supabase's site_url (:3000).
	const url = new URL(link!);
	expect(url.origin).toBe(new URL(baseURL!).origin);
	expect(url.pathname).toBe("/confirm");
	expect(url.searchParams.get("type")).toBe("email");
	expect(url.searchParams.get("next")).toBe("/dashboard");

	await page.goto(link!);
	// A new account sets its name before reaching the dashboard.
	await expect(page).toHaveURL(/\/welcome$/);
	await page.getByLabel("Your name").fill("Mail Tester");
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page).toHaveURL(/\/dashboard/);
	await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
});
