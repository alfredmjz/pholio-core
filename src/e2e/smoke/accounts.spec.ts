import { test, expect, expectNoHorizontalScroll, openDialog, uniqueName } from "@/e2e/fixtures";

test("create an account and record a deposit", { tag: "@smoke" }, async ({ page }, testInfo) => {
	// An account creation, a page load and a deposit: past the default 30s when the suite runs in parallel.
	test.slow();
	const accountName = uniqueName("E2E Chequing", testInfo.project.name);

	await page.goto("/accounts");
	const addDialog = page.getByRole("dialog", { name: "Add account" });
	await openDialog(page.getByRole("button", { name: /Add account/i }), addDialog);
	// Step 1: the kind of account. Picking a tile moves on to the details.
	await addDialog.getByRole("radio", { name: "Chequing", exact: true }).click();
	await addDialog.getByLabel(/Account name/i).fill(accountName);
	await addDialog.getByLabel(/Current balance/i).fill("1000");
	await addDialog.getByRole("button", { name: /Continue/ }).click();
	// Step 3: notes are optional.
	await addDialog.getByRole("button", { name: /Create Account/ }).click();

	await expect(page.getByText("Account created successfully")).toBeVisible();
	await expect(addDialog).toBeHidden();

	// Account detail: the balance comes from the database, so this checks the full write path.
	await page.getByRole("link", { name: new RegExp(accountName) }).click();
	await expect(page).toHaveURL(/\/accounts\/[\w-]+$/);
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
