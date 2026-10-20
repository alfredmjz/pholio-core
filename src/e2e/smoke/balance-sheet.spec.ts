import { test, expect, expectNoHorizontalScroll, openDialog, uniqueName } from "@/e2e/fixtures";

test("create an account and record a deposit", { tag: "@smoke" }, async ({ page }, testInfo) => {
	const accountName = uniqueName("E2E Chequing", testInfo.project.name);

	await page.goto("/balancesheet");
	const addDialog = page.getByRole("dialog", { name: "Add New Account" });
	await openDialog(page.getByRole("button", { name: /Add Account/ }), addDialog);
	await addDialog.getByLabel(/Account Name/).fill(accountName);
	await addDialog.getByRole("combobox").click();
	await page.getByRole("option", { name: "Chequing", exact: true }).click();
	await addDialog.getByLabel(/Current Balance/).fill("1000");
	await addDialog.getByRole("button", { name: /Create Account/ }).click();

	await expect(page.getByText("Account created successfully")).toBeVisible();
	await expect(addDialog).toBeHidden();

	// Account detail: the balance comes from the database, so this checks the full write path.
	await page.getByRole("link", { name: new RegExp(accountName) }).click();
	await expect(page).toHaveURL(/\/balancesheet\/accountdetail\//);
	await expect(page.getByText("$1,000.00").first()).toBeVisible();
	await expectNoHorizontalScroll(page);

	const transactionDialog = page.getByRole("dialog", { name: "Add Transaction" });
	await openDialog(page.getByRole("button", { name: "Add Deposit" }), transactionDialog);
	await transactionDialog.getByLabel(/Amount/).fill("250");
	await transactionDialog.getByLabel(/Description/).fill("E2E deposit");
	await transactionDialog.getByRole("button", { name: "Add Transaction" }).click();

	await expect(page.getByText("Transaction added")).toBeVisible();
	await expect(page.getByText("$1,250.00").first()).toBeVisible();
	await expect(page.getByText("E2E deposit").first()).toBeVisible();
});
