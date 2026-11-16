import type { Page } from "@playwright/test";
import { test, expect, openDialog, uniqueName } from "@/e2e/fixtures";

async function createAccount(page: Page, type: string, name: string, balance: string, debt = false) {
	await page.goto("/accounts");
	const addDialog = page.getByRole("dialog", { name: "Add account" });
	await openDialog(page.getByRole("button", { name: /Add account/i }), addDialog);
	if (debt) await addDialog.getByRole("radio", { name: "What you owe" }).click();
	await addDialog.getByRole("radio", { name: type, exact: true }).click();
	await addDialog.getByLabel(/Account name/i).fill(name);
	await addDialog.getByLabel(/Current balance/i).fill(balance);
	await addDialog.getByRole("button", { name: /Continue/ }).click();
	await addDialog.getByRole("button", { name: /Create Account/ }).click();
	await expect(page.getByText("Account created successfully")).toBeVisible();
	await expect(addDialog).toBeHidden();
}

// A monthly mortgage bill paid from chequing: each payment leaves chequing and lowers the mortgage,
// and it still counts as a bill in the budget.
test("a recurring bill pays down a mortgage", async ({ page }, testInfo) => {
	test.slow();
	const chequing = uniqueName("E2E Bill Chequing", testInfo.project.name);
	const mortgage = uniqueName("E2E Mortgage", testInfo.project.name);
	const name = uniqueName("E2E Mortgage payment", testInfo.project.name);

	await createAccount(page, "Chequing", chequing, "1000");
	await createAccount(page, "Mortgage", mortgage, "900", true);

	await page.goto("/recurring");
	const addDialog = page.getByRole("dialog", { name: "Add Recurring Expense" });
	await openDialog(page.getByRole("button", { name: /Add recurring/i }), addDialog);
	await addDialog.getByText("Bill", { exact: true }).click();
	await addDialog.getByPlaceholder("Netflix, Rent, etc.").fill(name);
	await addDialog.getByPlaceholder("0.00").fill("300");

	// A mortgage can't pay a bill, so it is only offered under "Pays down".
	await addDialog.getByLabel("Paid from").click();
	await expect(page.getByRole("option", { name: new RegExp(mortgage) })).toHaveCount(0);
	await page.getByRole("option", { name: new RegExp(chequing) }).click();
	await addDialog.getByLabel("Pays down").click();
	await expect(page.getByRole("option", { name: new RegExp(chequing) })).toHaveCount(0);
	await page.getByRole("option", { name: new RegExp(mortgage) }).click();
	await expect(addDialog.getByText(`lowers what you owe on ${mortgage}`, { exact: false })).toBeVisible();
	await addDialog.getByLabel("Auto-pay").click();
	await addDialog.getByRole("button", { name: /Add Expense/ }).click();
	await expect(page.getByText("Recurring expense added")).toBeVisible();

	const row = page.getByRole("list", { name: "Bills" }).getByRole("listitem").filter({ hasText: name });
	await expect(row.getByText("pays down")).toBeVisible();
	await row.getByRole("button", { name: "Pay", exact: true }).click();
	await expect(page.getByText(`${name} marked as paid`)).toBeVisible();
	await expect(row.getByText("1 of 1 paid this month")).toBeVisible();

	// Leave through the row's links, as a user would; a full page load can cut off the refresh.
	await row.getByRole("link", { name: mortgage, exact: true }).click();
	await expect(page).toHaveURL(/\/accounts\/[\w-]+$/);
	await expect(page.getByText("$600.00").first()).toBeVisible();
	await expect(page.getByText(`Payment from ${chequing}`, { exact: false }).first()).toBeVisible();

	await page.goBack();
	await row.getByRole("link", { name: chequing, exact: true }).click();
	await expect(page).toHaveURL(/\/accounts\/[\w-]+$/);
	await expect(page.getByText("$700.00").first()).toBeVisible();
	await expect(page.getByText(`Payment to ${mortgage}`, { exact: false }).first()).toBeVisible();
});
