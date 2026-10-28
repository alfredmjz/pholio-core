import { test, expect, expectNoHorizontalScroll } from "@/e2e/fixtures";

// The signed-in user is shared by every project running in parallel, so these tests only change
// settings saved on the device (theme) and leave the account's own settings alone.

const SECTIONS = [
	"Profile",
	"Sign-in",
	"Appearance",
	"Budgeting",
	"Contribution room",
	"Presets",
	"Region",
	"Notifications",
	"Your data",
];

test("every settings group is on one page, in order", { tag: "@smoke" }, async ({ page }) => {
	await page.goto("/settings");
	await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();

	const headings = page.getByRole("heading", { level: 2 });
	await expect(headings).toHaveText(SECTIONS);
	await expect(page.getByText(/placeholders/i)).toHaveCount(0);
	await expectNoHorizontalScroll(page);
});

test("the jump list moves to a group and marks it", { tag: "@smoke" }, async ({ page }) => {
	await page.goto("/settings");
	const nav = page.getByRole("navigation", { name: "Settings sections" });
	const link = nav.getByRole("link", { name: "Notifications" }).locator("visible=true");

	await link.click();
	await expect(page).toHaveURL(/\/settings#notifications$/);
	await expect(page.getByRole("heading", { name: "Notifications", level: 2 })).toBeInViewport();
	await expect(link).toHaveAttribute("aria-current", "location");
});

test("the old settings pages open their group", { tag: "@smoke" }, async ({ page }) => {
	// Four Settings page loads in a row.
	test.slow();
	for (const [path, hash] of [
		["/settings/profile", "#profile"],
		["/settings/security", "#sign-in"],
		["/settings/preferences", "#appearance"],
		["/settings/data-privacy", "#data"],
	]) {
		await page.goto(path, { waitUntil: "commit" });
		await expect(page).toHaveURL(new RegExp(`/settings${hash}$`));
		// Leaving a half-loaded page cancels its script chunks, which WebKit reports as uncaught errors.
		await page.waitForLoadState("load");
	}
});

test("the theme saves as soon as it's picked", { tag: "@smoke" }, async ({ page }) => {
	await page.goto("/settings#appearance");
	const theme = page.getByRole("group", { name: "Theme" });

	await theme.getByRole("radio", { name: "Dark" }).click();
	await expect(page.locator("html")).toHaveClass(/dark/);
	await page.reload();
	await expect(page.getByRole("group", { name: "Theme" }).getByRole("radio", { name: "Dark" })).toHaveAttribute(
		"aria-checked",
		"true"
	);

	await page.getByRole("group", { name: "Theme" }).getByRole("radio", { name: "Light" }).click();
	await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("deleting the account needs the word typed first", { tag: "@smoke" }, async ({ page }) => {
	await page.goto("/settings#data");
	await page.getByRole("button", { name: "Delete account" }).click();

	const dialog = page.getByRole("alertdialog", { name: "Delete your account?" });
	const confirm = dialog.getByRole("button", { name: "Delete account" });
	await expect(confirm).toBeDisabled();
	await dialog.getByLabel(/Type DELETE to confirm/).fill("delete");
	await expect(confirm).toBeDisabled();

	await dialog.getByRole("button", { name: "Cancel" }).click();
	await expect(dialog).toBeHidden();
});
