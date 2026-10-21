import { test, expect, openDialog, uniqueName } from "@/e2e/fixtures";

// The account page used to offer Payment only under Expense, which on a credit card was stored
// as a charge and raised the debt. On a liability the quick actions now record a payment
// (debt down) and a charge (debt up).
test("record a payment and a charge on a credit card", async ({ page }, testInfo) => {
	const accountName = uniqueName("E2E Credit Card", testInfo.project.name);

	await page.goto("/balancesheet");
	const addDialog = page.getByRole("dialog", { name: "Add New Account" });
	await openDialog(page.getByRole("button", { name: /Add Account/ }), addDialog);
	await addDialog.getByRole("button", { name: /Liability/ }).click();
	await addDialog.getByLabel(/Account Name/).fill(accountName);
	await addDialog.getByRole("combobox").click();
	await page.getByRole("option", { name: "Credit Card", exact: true }).click();
	await addDialog.getByLabel(/Current Balance/).fill("500");
	await addDialog.getByRole("button", { name: /Create Account/ }).click();
	await expect(page.getByText("Account created successfully")).toBeVisible();

	await page.getByRole("link", { name: new RegExp(accountName) }).click();
	await expect(page).toHaveURL(/\/balancesheet\/accountdetail\//);
	await expect(page.getByText("$500.00").first()).toBeVisible();

	const transactionDialog = page.getByRole("dialog", { name: "Add Transaction" });

	await openDialog(page.getByRole("button", { name: "Record Payment" }), transactionDialog);
	await expect(transactionDialog.getByRole("combobox").filter({ hasText: "Payment" })).toBeVisible();
	await transactionDialog.getByLabel(/Amount/).fill("40");
	await transactionDialog.getByLabel(/Description/).fill("E2E card payment");
	await transactionDialog.getByRole("button", { name: "Add Transaction" }).click();
	await expect(page.getByText("Transaction added").first()).toBeVisible();
	await expect(page.getByText("$460.00").first()).toBeVisible();

	await openDialog(page.getByRole("button", { name: "Record Charge" }), transactionDialog);
	await expect(transactionDialog.getByRole("combobox").filter({ hasText: "Purchase / Charge" })).toBeVisible();
	await transactionDialog.getByLabel(/Amount/).fill("25");
	await transactionDialog.getByLabel(/Description/).fill("E2E card charge");
	await transactionDialog.getByRole("button", { name: "Add Transaction" }).click();
	await expect(page.getByText("$485.00").first()).toBeVisible();
	await expect(page.getByText("Purchase / Charge").first()).toBeVisible();
});
