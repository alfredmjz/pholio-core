import { test, expect, openDialog, uniqueName } from "@/e2e/fixtures";

// account_transactions used to reject transaction_type = 'refund' (fixed in migration 014),
// so a Refund tagged to an account failed with "Failed to create account transaction".
test("record a refund against an account", async ({ page }, testInfo) => {
	const accountName = uniqueName("E2E Refund Chequing", testInfo.project.name);

	await page.goto("/balancesheet");
	const addDialog = page.getByRole("dialog", { name: "Add New Account" });
	await openDialog(page.getByRole("button", { name: /Add Account/ }), addDialog);
	await addDialog.getByLabel(/Account Name/).fill(accountName);
	await addDialog.getByRole("combobox").click();
	await page.getByRole("option", { name: "Chequing", exact: true }).click();
	await addDialog.getByLabel(/Current Balance/).fill("1000");
	await addDialog.getByRole("button", { name: /Create Account/ }).click();
	await expect(page.getByText("Account created successfully")).toBeVisible();

	await page.getByRole("link", { name: new RegExp(accountName) }).click();
	await expect(page).toHaveURL(/\/balancesheet\/accountdetail\//);
	await expect(page.getByText("$1,000.00").first()).toBeVisible();

	const transactionDialog = page.getByRole("dialog", { name: "Add Transaction" });
	await openDialog(page.getByRole("button", { name: "Add Deposit" }), transactionDialog);
	await transactionDialog.getByRole("combobox").filter({ hasText: "Deposit" }).click();
	await page.getByRole("option", { name: /Refund/ }).click();
	await transactionDialog.getByLabel(/Amount/).fill("40");
	await transactionDialog.getByLabel(/Description/).fill("E2E refund");
	await transactionDialog.getByRole("button", { name: "Add Transaction" }).click();

	await expect(page.getByText("Transaction added")).toBeVisible();
	await expect(page.getByText("$1,040.00").first()).toBeVisible();
	await expect(page.getByText("E2E refund").first()).toBeVisible();
});
