import { test, expect, isMobileLayout } from "@/e2e/fixtures";
import { NAV_DESTINATIONS } from "@/e2e/support/routes";

test("main navigation reaches every section", { tag: "@smoke" }, async ({ page }) => {
	await page.goto("/dashboard");

	for (const { label, path } of NAV_DESTINATIONS) {
		const link = isMobileLayout(page)
			? page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: label })
			: page.getByRole("link", { name: label, exact: true }).first();

		await link.click();
		await expect(page).toHaveURL(new RegExp(`${path}$`));

		if (isMobileLayout(page)) {
			await expect(link).toHaveAttribute("aria-current", "page");
		}
	}
});
