import { test, expect, expectNoHorizontalScroll, openDialog, uniqueName } from "@/e2e/fixtures";

// #150: an account with an NSF fee warns before a bill would overdraw it, and paying the bill
// posts the fee with the payment.
test("a bill that overdraws an account warns first and posts the NSF fee", async ({ page }, testInfo) => {
	test.slow();
	const accountName = uniqueName("E2E Fee Chequing", testInfo.project.name);
	const billName = uniqueName("E2E Fee Phone", testInfo.project.name);

	await page.goto("/accounts");
	const addAccount = page.getByRole("dialog", { name: "Add account" });
	await openDialog(page.getByRole("button", { name: /Add account/i }), addAccount);
	await addAccount.getByRole("radio", { name: "Chequing", exact: true }).click();
	await addAccount.getByLabel(/Account name/i).fill(accountName);
	await addAccount.getByLabel(/Current balance/i).fill("20");
	await expect(addAccount.getByLabel(/Overdraft limit/)).toHaveCount(0);
	await addAccount.getByLabel(/NSF fee/).fill("45");
	await addAccount.getByRole("button", { name: /Continue/ }).click();
	await addAccount.getByRole("button", { name: /Create Account/ }).click();
	await expect(page.getByText("Account created successfully")).toBeVisible();

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

	// $20 can't cover the $60 bill, so the row warns about the fee before it's paid.
	const billRow = page.getByRole("list", { name: "Bills" }).getByRole("listitem").filter({ hasText: billName });
	await expect(billRow.getByText(/will overdraw .*\(\$45\.00 NSF fee\)/)).toBeVisible();
	await expectNoHorizontalScroll(page);

	await billRow.getByRole("button", { name: "Pay", exact: true }).click();
	await expect(page.getByText(`${billName} marked as paid`)).toBeVisible();

	// 20 - 60 = -40, then the 45 NSF fee: -85, with the fee in Activity.
	await billRow.getByRole("link", { name: accountName }).click();
	await expect(page).toHaveURL(/\/accounts\/[\w-]+$/);
	await expect(page.getByText(/85\.00/).first()).toBeVisible();
	await expect(page.getByRole("button", { name: /NSF fee/ })).toBeVisible();

	// Deleting the payment gives back the 60 and its fee.
	const editLedger = page.getByRole("dialog", { name: "Edit Transaction" });
	await openDialog(page.getByRole("button", { name: new RegExp(billName) }), editLedger);
	await editLedger.getByRole("button", { name: "Delete transaction" }).click();
	await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
	await expect(page.getByRole("button", { name: /NSF fee/ })).toHaveCount(0);
	await expect(page.getByText("$20.00").first()).toBeVisible();
});
