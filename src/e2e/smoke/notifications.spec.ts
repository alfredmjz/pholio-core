import { test, expect, expectNoHorizontalScroll, isMobileLayout } from "@/e2e/fixtures";
import { CHANGELOG } from "@/lib/changelog";

// The shared signed-in user is new, so it has no reminders yet and has seen every release.
test("the bell opens reminders and what's new", { tag: "@smoke" }, async ({ page }) => {
	await page.goto("/dashboard");
	const bell = page.getByRole("button", { name: /^Notifications/ }).locator("visible=true");
	await expect(bell).toHaveAccessibleName("Notifications");

	await bell.click();
	const show = page.getByRole("group", { name: "Show" });
	await expect(show.getByRole("radio", { name: "Account" })).toHaveAttribute("aria-checked", "true");
	await expect(page.getByText(/Nothing coming up/)).toBeVisible();

	await show.getByRole("radio", { name: "What's new" }).click();
	const changelog = page.getByRole("list", { name: "What's new" });
	await expect(changelog.getByRole("heading", { name: CHANGELOG[0].title })).toBeVisible();
	if (isMobileLayout(page)) await expectNoHorizontalScroll(page);
});
