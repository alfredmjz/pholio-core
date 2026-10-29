import { test, expect, SIGNED_OUT } from "@/e2e/fixtures";

test("dashboard shows every module for a signed-in user", { tag: "@smoke" }, async ({ page }) => {
	await page.goto("/dashboard");

	await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeAttached();
	for (const name of ["Net worth", "Coming up", "Cash flow", "Accounts", "Recent activity"]) {
		await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
	}
	await expect(page.getByRole("heading", { name: /so far$/ })).toBeVisible();
});

test.describe("demo dashboard", { tag: "@smoke" }, () => {
	test.use({ storageState: SIGNED_OUT });

	test("net worth line can be scrubbed by keyboard and the range changed", async ({ page }) => {
		// Starting the demo re-renders the layout and then the whole demo dashboard, which is slow
		// under a full parallel run.
		test.slow();
		await page.goto("/login");
		await page.getByRole("button", { name: "Try the demo" }).click();
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

		const line = page.getByRole("slider", { name: "Net worth over time" });
		await expect(line).toBeVisible();

		const last = Number(await line.getAttribute("aria-valuemax"));
		await expect(line).toHaveAttribute("aria-valuenow", String(last));

		await line.focus();
		await page.keyboard.press("Home");
		await expect(line).toHaveAttribute("aria-valuenow", "0");
		await page.keyboard.press("Escape");
		await expect(line).toHaveAttribute("aria-valuenow", String(last));

		// A longer range has more history points.
		await page.getByRole("radio", { name: "the last year" }).click();
		await expect
			.poll(async () => Number(await line.getAttribute("aria-valuemax")), { message: "1Y has more points than 3M" })
			.toBeGreaterThan(last);
	});
});
