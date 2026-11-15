import type { Page } from "@playwright/test";
import { test, expect, openDialog, uniqueName } from "@/e2e/fixtures";

async function createAccount(page: Page, owe: boolean, type: string, name: string, balance: string) {
	await page.goto("/accounts");
	const addDialog = page.getByRole("dialog", { name: "Add account" });
	await openDialog(page.getByRole("button", { name: /Add account/i }), addDialog);
	if (owe) await addDialog.getByRole("radio", { name: "What you owe" }).click();
	// Step 1: the kind of account. Picking a tile moves on to the details.
	await addDialog.getByRole("radio", { name: type, exact: true }).click();
	await addDialog.getByLabel(/Account name/i).fill(name);
	await addDialog.getByLabel(/Current balance/i).fill(balance);
	await addDialog.getByRole("button", { name: /Continue/ }).click();
	// Step 3: notes are optional.
	await addDialog.getByRole("button", { name: /Create Account/ }).click();
	await expect(page.getByText("Account created successfully")).toBeVisible();
	await expect(addDialog).toBeHidden();
}

// A payment on a debt is a transfer from the paying account into the debt: it lowers what is owed,
// shows on both accounts and is never counted as spending again. A charge raises the debt.
test("record a payment and a charge on a credit card", async ({ page }, testInfo) => {
	test.slow();
	const chequing = uniqueName("E2E Pay Chequing", testInfo.project.name);
	const card = uniqueName("E2E Credit Card", testInfo.project.name);
	await createAccount(page, false, "Chequing", chequing, "1000");
	await createAccount(page, true, "Credit Card", card, "500");

	await page.getByRole("link", { name: new RegExp(card) }).click();
	await expect(page).toHaveURL(/\/accounts\/[\w-]+$/);
	await expect(page.getByText("$500.00").first()).toBeVisible();

	const transactionDialog = page.getByRole("dialog", { name: "Add Transaction" });

	await openDialog(page.getByRole("button", { name: "Record Payment" }), transactionDialog);
	await expect(transactionDialog.getByText(`This is a payment on ${card}`, { exact: false })).toBeVisible();
	await transactionDialog.getByRole("combobox", { name: "From account" }).click();
	await page.getByRole("option", { name: new RegExp(chequing) }).click();
	await transactionDialog.getByRole("button", { name: /Continue/ }).click();
	await transactionDialog.getByLabel(/Amount/).fill("40");
	// The dialog ignores a submit within 500ms of Continue (a double click would otherwise save).
	await page.waitForTimeout(600);
	await transactionDialog.getByRole("button", { name: /Add payment/ }).click();
	await expect(page.getByText("Payment recorded").first()).toBeVisible();
	await expect(page.getByText("$460.00").first()).toBeVisible();
	await expect(page.getByText(`Payment from ${chequing}`, { exact: false }).first()).toBeVisible();

	await openDialog(page.getByRole("button", { name: "Record Charge" }), transactionDialog);
	await expect(transactionDialog.getByRole("combobox").filter({ hasText: "Purchase / Charge" })).toBeVisible();
	await transactionDialog.getByLabel(/Amount/).fill("25");
	await transactionDialog.getByLabel(/Description/).fill("E2E card charge");
	await transactionDialog.getByRole("button", { name: /Add transaction/i }).click();
	await expect(page.getByText("$485.00").first()).toBeVisible();
	await expect(page.getByText("Purchase / Charge").first()).toBeVisible();

	await page.goto("/accounts");
	await page.getByRole("link", { name: new RegExp(chequing) }).click();
	await expect(page.getByText("$960.00").first()).toBeVisible();
	await expect(page.getByText(`Payment to ${card}`, { exact: false }).first()).toBeVisible();
});
