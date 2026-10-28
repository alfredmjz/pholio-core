import { test, expect, expectNoHorizontalScroll, openDialog, uniqueName } from "@/e2e/fixtures";

// #106: a bill paid from an account posts each payment to that account, and the account's
// activity, the budget row in Allocations and the account page link to each other.
test("a bill paid from an account links its payment across pages", { tag: "@smoke" }, async ({ page }, testInfo) => {
	// Four pages and three dialogs; WebKit under parallel load needs more than the default.
	test.slow();
	const accountName = uniqueName("E2E Bills Chequing", testInfo.project.name);
	const billName = uniqueName("E2E Phone", testInfo.project.name);

	await page.goto("/accounts");
	const addAccount = page.getByRole("dialog", { name: "Add account" });
	await openDialog(page.getByRole("button", { name: /Add account/i }), addAccount);
	await addAccount.getByRole("radio", { name: "Chequing", exact: true }).click();
	await addAccount.getByLabel(/Account name/i).fill(accountName);
	await addAccount.getByLabel(/Current balance/i).fill("100");
	await addAccount.getByRole("button", { name: /Continue/ }).click();
	await addAccount.getByRole("button", { name: /Create Account/ }).click();
	await expect(page.getByText("Account created successfully")).toBeVisible();

	// A manual bill due today, paid from the new account. The page is still refreshing after the
	// save: a full page.goto would cut that refresh off and Next would answer with a reload of
	// /accounts, so leave through the app's own link like a user would.
	await page.getByRole("link", { name: "Recurring", exact: true }).filter({ visible: true }).first().click();
	await expect(page).toHaveURL(/\/recurring$/);
	const addBill = page.getByRole("dialog", { name: "Add Recurring Expense" });
	await openDialog(page.getByRole("button", { name: /Add recurring/i }), addBill);
	await addBill.getByText("Bill", { exact: true }).click();
	await addBill.getByPlaceholder("Netflix, Rent, etc.").fill(billName);
	await addBill.getByPlaceholder("0.00").fill("60");
	await addBill.getByLabel("Paid from").click();
	await page.getByRole("option", { name: accountName }).click();
	await addBill.getByLabel("Auto-pay").click();
	await addBill.getByRole("button", { name: /Add Expense/ }).click();
	await expect(page.getByText("Recurring expense added")).toBeVisible();

	const billRow = page.getByRole("list", { name: "Bills" }).getByRole("listitem").filter({ hasText: billName });
	await expect(billRow.getByRole("link", { name: accountName })).toBeVisible();
	await billRow.getByRole("button", { name: "Pay", exact: true }).click();
	await expect(page.getByText(`${billName} marked as paid`)).toBeVisible();

	// The payment is on the account: balance down by 60 and a row in Activity.
	await billRow.getByRole("link", { name: accountName }).click();
	await expect(page).toHaveURL(/\/accounts\/[\w-]+$/);
	const accountUrl = page.url();
	await expect(page.getByText("$40.00").first()).toBeVisible();
	await expect(page.getByRole("region", { name: "Recurring" }).getByText(billName)).toBeVisible();
	await expectNoHorizontalScroll(page);

	const editLedger = page.getByRole("dialog", { name: "Edit Transaction" });
	await openDialog(page.getByRole("button", { name: new RegExp(billName) }), editLedger);
	await editLedger.getByRole("link", { name: /View in Allocations/ }).click();

	// Allocations opens that month with the budget row open, then drops the parameter. The account
	// page stays on screen until Allocations has loaded, and its own "Edit Transaction" dialog would
	// match a case-insensitive name, so wait for the URL and match the name exactly.
	await expect(page).toHaveURL(/\/allocations/, { timeout: 20_000 });
	const editBudget = page.getByRole("dialog", { name: "Edit transaction", exact: true });
	await expect(editBudget).toBeVisible({ timeout: 20_000 });
	await expect(page).not.toHaveURL(/transaction=/);
	await expect(editBudget.getByPlaceholder("e.g. Grocery Store")).toHaveValue(billName);

	await editBudget.getByRole("link", { name: accountName }).click();
	await expect(page).toHaveURL(accountUrl);
});
