import { test, expect, SIGNED_OUT } from "@/e2e/fixtures";
import { NAV_DESTINATIONS } from "@/e2e/support/routes";

test("a new account starts on a cloudy sky on every main page", { tag: "@smoke" }, async ({ page }) => {
	// Each run signs in a fresh user with no history, which is always graded cloudy.
	for (const { path } of NAV_DESTINATIONS) {
		await page.goto(path);
		const backdrop = page.locator(".surface-backdrop");
		await expect(backdrop).toHaveAttribute("data-backdrop", "adaptive");
		await expect(backdrop).toHaveAttribute("data-weather", "cloudy");
		await expect(backdrop.locator("canvas")).toHaveCount(1);
	}
});

test("the background setting changes the backdrop and is remembered", { tag: "@smoke" }, async ({ page }) => {
	const backdrop = page.locator(".surface-backdrop");
	const choose = async (name: string) => {
		await page.goto("/settings/preferences");
		const option = page.getByRole("radio", { name });
		await option.click();
		await expect(option).toHaveAttribute("aria-checked", "true");
		await page.goto("/dashboard");
	};

	await choose("No Background");
	await expect(backdrop).toHaveAttribute("data-backdrop", "none");
	await expect(backdrop.locator("canvas")).toHaveCount(0);

	await choose("Wind Background");
	await expect(backdrop).toHaveAttribute("data-backdrop", "wind");
	await expect(backdrop).not.toHaveAttribute("data-weather");
	await expect(backdrop.locator("canvas")).toHaveCount(1);

	await choose("Adaptive Background");
	await expect(backdrop).toHaveAttribute("data-backdrop", "adaptive");
	await expect(backdrop).toHaveAttribute("data-weather", "cloudy");
});

test("a mood in the URL is dropped on load and never overrides the data", { tag: "@smoke" }, async ({ page }) => {
	await page.goto("/dashboard?weather=rainy");
	await expect(page).toHaveURL(/\/dashboard$/);
	await expect(page.locator(".surface-backdrop")).toHaveAttribute("data-weather", "cloudy");

	await page.goto("/allocations?year=2026&month=10&weather=rainy");
	await expect(page).toHaveURL(/\/allocations\?year=2026&month=10$/);
});

test.describe("signed out", { tag: "@smoke" }, () => {
	test.use({ storageState: SIGNED_OUT });

	test("the login page keeps its own wind and no weather", async ({ page }) => {
		await page.goto("/login");
		await expect(page.locator(".login-field-canvas")).toBeAttached();
		await expect(page.locator(".surface-backdrop")).toHaveCount(0);
	});
});
