import { test, expect, expectNoHorizontalScroll, isMobileLayout } from "@/e2e/fixtures";
import { APP_ROUTES } from "@/e2e/support/routes";

for (const route of APP_ROUTES) {
	test(`${route} renders without sideways scroll`, { tag: "@smoke" }, async ({ page }) => {
		await page.goto(route);
		await page.waitForLoadState("networkidle");

		const { pathname } = new URL(page.url());
		expect(pathname, "redirected away from a signed-in page").toMatch(new RegExp(`^${route}`));
		await expect(page.getByRole("heading").first()).toBeVisible();

		// Located by attribute, not role: a first-visit dialog (e.g. allocations month setup)
		// hides the page behind it from the accessibility tree, but the bar is still on screen.
		if (isMobileLayout(page)) {
			await expect(page.locator('nav[aria-label="Primary"]')).toBeVisible();
		}

		await expectNoHorizontalScroll(page);
	});
}
