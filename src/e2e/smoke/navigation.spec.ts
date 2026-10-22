import { test, expect, isMobileLayout } from "@/e2e/fixtures";
import { NAV_DESTINATIONS } from "@/e2e/support/routes";

test("main navigation reaches every section", { tag: "@smoke" }, async ({ page }) => {
	await page.goto("/dashboard");

	for (const { label, path } of NAV_DESTINATIONS) {
		const link = isMobileLayout(page)
			? page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: label })
			: page.getByRole("link", { name: label, exact: true }).first();

		// A page can open a first-visit dialog shortly after loading (e.g. Allocations' month setup),
		// which covers the navigation. Close it and try again rather than racing it.
		await expect(async () => {
			if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
			await link.click({ timeout: 2_000 });
		}).toPass({ timeout: 20_000 });
		await expect(page).toHaveURL(new RegExp(`${path}$`));

		if (isMobileLayout(page)) {
			await expect(link).toHaveAttribute("aria-current", "page");
		}
	}
});
