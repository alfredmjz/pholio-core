import { test, expect, expectNoHorizontalScroll, openDialog, uniqueName } from "@/e2e/fixtures";

// #150: a card lists its own charges. A cash advance posts the card's cash advance fee with it,
// and deleting the advance takes the fee back.
test("credit card charges: add, cash advance fee, remove", async ({ page }, testInfo) => {
	test.slow();
	const accountName = uniqueName("E2E Charges Card", testInfo.project.name);
	const advanceName = uniqueName("E2E ATM", testInfo.project.name);

	await page.goto("/accounts");
	const addAccount = page.getByRole("dialog", { name: "Add account" });
	await openDialog(page.getByRole("button", { name: /Add account/i }), addAccount);
	await addAccount.getByRole("radio", { name: "What you owe" }).click();
	await addAccount.getByRole("radio", { name: "Credit Card", exact: true }).click();
	await addAccount.getByLabel(/Account name/i).fill(accountName);
	await addAccount.getByLabel(/Current balance/i).fill("100");
	await addAccount.getByRole("button", { name: /Continue/ }).click();
	await addAccount.getByRole("button", { name: /Create Account/ }).click();
	await expect(page.getByText("Account created successfully")).toBeVisible();

	await page.getByRole("link", { name: new RegExp(accountName) }).click();
	await expect(page).toHaveURL(/\/accounts\/[\w-]+$/);
	await expect(page.getByText("No charges on this account.")).toBeVisible();

	const chargeDialog = page.getByRole("dialog", { name: "Add charge" });

	await openDialog(page.getByRole("button", { name: "Add charge" }), chargeDialog);
	// Only an account that holds money can waive a fee.
	await expect(chargeDialog.getByLabel(/Waived above/)).toHaveCount(0);
	await chargeDialog.getByRole("radio", { name: "Per cash advance" }).click();
	await expect(chargeDialog.getByLabel("Name")).toHaveValue("Cash advance fee");
	await chargeDialog.getByLabel(/Fee \(%\)/).fill("5");
	await chargeDialog.getByLabel(/Minimum fee/).fill("3.50");
	await chargeDialog.getByRole("button", { name: "Add charge" }).click();
	await expect(page.getByText("5% (at least $3.50) per cash advance")).toBeVisible();

	await openDialog(page.getByRole("button", { name: "Add charge" }), chargeDialog);
	await chargeDialog.getByRole("radio", { name: "Every year" }).click();
	await expect(chargeDialog.getByLabel("Name")).toHaveValue("Annual fee");
	await chargeDialog.getByLabel(/Amount/).fill("120");
	await chargeDialog.getByRole("button", { name: "Add charge" }).click();
	await expect(page.getByText(/\$120\.00 a year, next/)).toBeVisible();
	await expectNoHorizontalScroll(page);

	// 5% of 200 is 10, above the 3.50 minimum: 100 + 200 + 10 = 310.
	const transactionDialog = page.getByRole("dialog", { name: "Add Transaction" });
	await openDialog(page.getByRole("button", { name: "Record Charge" }), transactionDialog);
	await transactionDialog.getByLabel(/Amount/).fill("200");
	await transactionDialog.getByLabel(/Description/).fill(advanceName);
	await transactionDialog.getByRole("switch", { name: /Cash advance/ }).click();
	await transactionDialog.getByRole("button", { name: "Add Transaction" }).click();
	await expect(page.getByText("$310.00").first()).toBeVisible();
	await expect(page.getByRole("button", { name: /^Cash advance fee/ })).toBeVisible();

	const editLedger = page.getByRole("dialog", { name: "Edit Transaction" });
	await openDialog(page.getByRole("button", { name: new RegExp(advanceName) }), editLedger);
	await editLedger.getByRole("button", { name: "Delete transaction" }).click();
	await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
	await expect(page.getByRole("button", { name: /^Cash advance fee/ })).toHaveCount(0);
	await expect(page.getByText("$100.00").first()).toBeVisible();

	await page.getByRole("button", { name: "Remove Annual fee" }).click();
	await page.getByRole("alertdialog").getByRole("button", { name: "Remove", exact: true }).click();
	await expect(page.getByText("Charge removed")).toBeVisible();
	await expect(page.getByText(/\$120\.00 a year/)).toHaveCount(0);
});
