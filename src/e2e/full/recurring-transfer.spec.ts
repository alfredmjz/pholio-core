import type { Page } from "@playwright/test";
import { test, expect, openDialog, uniqueName } from "@/e2e/fixtures";

async function createAccount(page: Page, type: string, name: string, balance: string) {
	await page.goto("/accounts");
	const addDialog = page.getByRole("dialog", { name: "Add account" });
	await openDialog(page.getByRole("button", { name: /Add account/i }), addDialog);
	await addDialog.getByRole("radio", { name: type, exact: true }).click();
	await addDialog.getByLabel(/Account name/i).fill(name);
	await addDialog.getByLabel(/Current balance/i).fill(balance);
	await addDialog.getByRole("button", { name: /Continue/ }).click();
	await addDialog.getByRole("button", { name: /Create Account/ }).click();
	await expect(page.getByText("Account created successfully")).toBeVisible();
	await expect(addDialog).toBeHidden();
}

// A recurring transfer moves money between two of the user's accounts. With automatic transfers
// off, pressing Transfer records it on both accounts and it is not counted as spending.
test("a recurring transfer moves money between two accounts", async ({ page }, testInfo) => {
	test.slow();
	const from = uniqueName("E2E Chequing", testInfo.project.name);
	const to = uniqueName("E2E Savings", testInfo.project.name);
	const name = uniqueName("E2E Savings top-up", testInfo.project.name);

	await createAccount(page, "Chequing", from, "1000");
	await createAccount(page, "Savings", to, "0");

	await page.goto("/recurring");
	const addDialog = page.getByRole("dialog", { name: "Add Recurring Expense" });
	await openDialog(page.getByRole("button", { name: /Add recurring/i }), addDialog);
	await addDialog.getByText("Transfer or payment", { exact: true }).click();
	await addDialog.getByPlaceholder("TFSA contribution, savings, etc.").fill(name);
	await addDialog.getByPlaceholder("0.00").fill("200");

	// Both accounts are required.
	await addDialog.getByRole("button", { name: /Add Transfer/ }).click();
	await expect(page.getByText("Choose two accounts")).toBeVisible();

	await addDialog.getByLabel(/^From/).click();
	await page.getByRole("option", { name: new RegExp(from) }).click();
	await addDialog.getByLabel(/^To/).click();
	await expect(page.getByRole("option", { name: new RegExp(from) })).toHaveCount(0);
	await page.getByRole("option", { name: new RegExp(to) }).click();
	await addDialog.getByLabel("Automatic transfer").click();
	await addDialog.getByRole("button", { name: /Add Transfer/ }).click();
	await expect(page.getByText("Recurring transfer added")).toBeVisible();

	const row = page.getByRole("list", { name: "Transfers" }).getByRole("listitem").filter({ hasText: name });
	await expect(row).toBeVisible();
	await row.getByRole("button", { name: "Transfer", exact: true }).click();
	await expect(page.getByText(`${name} recorded`)).toBeVisible();
	await page.reload();
	await expect(row.getByText("1 of 1 done this month")).toBeVisible();

	await page.goto("/accounts");
	await page.getByRole("link", { name: new RegExp(from) }).click();
	await expect(page.getByText("$800.00").first()).toBeVisible();

	await page.goto("/accounts");
	await page.getByRole("link", { name: new RegExp(to) }).click();
	await expect(page.getByText("$200.00").first()).toBeVisible();
});

async function createDebt(page: Page, type: string, name: string, balance: string) {
	await page.goto("/accounts");
	const addDialog = page.getByRole("dialog", { name: "Add account" });
	await openDialog(page.getByRole("button", { name: /Add account/i }), addDialog);
	await addDialog.getByRole("radio", { name: "What you owe" }).click();
	await addDialog.getByRole("radio", { name: type, exact: true }).click();
	await addDialog.getByLabel(/Account name/i).fill(name);
	await addDialog.getByLabel(/Current balance/i).fill(balance);
	await addDialog.getByRole("button", { name: /Continue/ }).click();
	await addDialog.getByRole("button", { name: /Create Account/ }).click();
	await expect(page.getByText("Account created successfully")).toBeVisible();
	await expect(addDialog).toBeHidden();
}

// Paying a line of credit from a credit card every month is a recurring transfer into the debt:
// the line of credit shows the payment and its debt drops, the card's debt rises by the same.
test("a recurring payment from a card pays down a line of credit", async ({ page }, testInfo) => {
	test.slow();
	const card = uniqueName("E2E Amex", testInfo.project.name);
	const loc = uniqueName("E2E LOC", testInfo.project.name);
	const name = uniqueName("E2E LOC payment", testInfo.project.name);

	await createDebt(page, "Credit Card", card, "200");
	await createDebt(page, "Line of Credit", loc, "1000");

	await page.goto("/recurring");
	const addDialog = page.getByRole("dialog", { name: "Add Recurring Expense" });
	await openDialog(page.getByRole("button", { name: /Add recurring/i }), addDialog);
	await addDialog.getByText("Transfer or payment", { exact: true }).click();
	await addDialog.getByPlaceholder("TFSA contribution, savings, etc.").fill(name);
	await addDialog.getByPlaceholder("0.00").fill("100");
	await addDialog.getByLabel(/^From/).click();
	await page.getByRole("option", { name: new RegExp(card) }).click();
	await addDialog.getByLabel(/^To/).click();
	await page.getByRole("option", { name: new RegExp(loc) }).click();
	await expect(addDialog.getByText(`lowers what you owe on ${loc}`, { exact: false })).toBeVisible();
	await addDialog.getByLabel("Automatic transfer").click();
	await addDialog.getByRole("button", { name: /Add Transfer/ }).click();
	await expect(page.getByText("Recurring transfer added")).toBeVisible();

	const row = page.getByRole("list", { name: "Transfers" }).getByRole("listitem").filter({ hasText: name });
	await row.getByRole("button", { name: "Transfer", exact: true }).click();
	await expect(page.getByText(`${name} recorded`)).toBeVisible();

	await page.goto("/accounts");
	await page.getByRole("link", { name: new RegExp(loc) }).click();
	await expect(page.getByText("$900.00").first()).toBeVisible();
	await expect(page.getByText(`Payment from ${card}`, { exact: false }).first()).toBeVisible();

	await page.goto("/accounts");
	await page.getByRole("link", { name: new RegExp(card) }).click();
	await expect(page.getByText("$300.00").first()).toBeVisible();
	await expect(page.getByText(`Payment to ${loc}`, { exact: false }).first()).toBeVisible();
});
