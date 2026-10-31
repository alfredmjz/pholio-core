import { test, expect, expectNoHorizontalScroll, openDialog, uniqueName } from "@/e2e/fixtures";

// Edit lets an account change type within its class, and clears what the new type doesn't use.
test("change a savings account to chequing in Edit", async ({ page }, testInfo) => {
	test.slow();
	const accountName = uniqueName("E2E Type Savings", testInfo.project.name);

	await page.goto("/accounts");
	const addAccount = page.getByRole("dialog", { name: "Add account" });
	await openDialog(page.getByRole("button", { name: /Add account/i }), addAccount);
	await addAccount.getByRole("radio", { name: "Savings", exact: true }).click();
	await addAccount.getByLabel(/Account name/i).fill(accountName);
	await addAccount.getByLabel(/Current balance/i).fill("1000");
	await addAccount.getByLabel(/^APY/).fill("4");
	await addAccount.getByRole("button", { name: /Continue/ }).click();
	await addAccount.getByRole("button", { name: /Create Account/ }).click();
	await expect(page.getByText("Account created successfully")).toBeVisible();

	await page.getByRole("link", { name: new RegExp(accountName) }).click();
	await expect(page).toHaveURL(/\/accounts\/[\w-]+$/);

	const editAccount = page.getByRole("dialog", { name: "Edit account" });
	await page.getByRole("button", { name: `More actions for ${accountName}` }).click();
	await openDialog(page.getByRole("menuitem", { name: "Edit details" }), editAccount);
	await expect(editAccount.getByLabel(/APY/)).toHaveValue("4");

	// Only types of the same class are offered: an asset can't become a credit card.
	await editAccount.getByLabel("Account Type").click();
	await expect(page.getByRole("option", { name: "Investment" })).toBeVisible();
	await expect(page.getByRole("option", { name: "Credit Card" })).toHaveCount(0);
	await page.getByRole("option", { name: "Chequing" }).click();

	await expect(editAccount.getByText("Clears the saved interest rate.")).toBeVisible();
	await expect(editAccount.getByLabel(/APY/)).toHaveCount(0);
	await expectNoHorizontalScroll(page);
	await editAccount.getByRole("button", { name: /Save Changes/ }).click();

	await expect(page.getByText("Account updated")).toBeVisible();
	await expect(page.getByText("Chequing", { exact: true }).first()).toBeVisible();
	await expect(page.getByText("$1,000.00").first()).toBeVisible();

	// After a reload the server copy is the chequing account, with the rate gone.
	await page.reload();
	await expect(page.getByText("Chequing", { exact: true }).first()).toBeVisible();
	await page.getByRole("button", { name: `More actions for ${accountName}` }).click();
	await openDialog(page.getByRole("menuitem", { name: "Edit details" }), editAccount);
	await expect(editAccount.getByLabel("Account Type")).toHaveText("Chequing");
	await expect(editAccount.getByText("Clears the saved")).toHaveCount(0);
});
