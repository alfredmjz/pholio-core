import { test, expect, expectNoHorizontalScroll, SIGNED_OUT } from "@/e2e/fixtures";

test.use({ storageState: SIGNED_OUT });

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

	test("try the demo opens the dashboard with sample data", async ({ page }) => {
		await page.goto("/login");
		await page.getByRole("button", { name: "Try the demo" }).click();

		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
	});
});
