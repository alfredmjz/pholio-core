import { test, expect, expectNoHorizontalScroll, openDialog, uniqueName } from "@/e2e/fixtures";
import type { Page } from "@playwright/test";

// Room is pooled per user and plan, and the desktop, Android and iPhone projects share one
// signed-in user, so each project uses its own plan to keep their pools apart.
const PLAN_BY_PROJECT: Record<string, string> = { desktop: "TFSA", android: "FHSA", iphone: "RESP" };

async function createRegisteredAccount(page: Page, plan: string, accountName: string, room?: string) {
	await page.goto("/balancesheet");
	const addDialog = page.getByRole("dialog", { name: "Add New Account" });
	await openDialog(page.getByRole("button", { name: /Add Account/ }), addDialog);
	await addDialog.getByLabel(/Account Name/).fill(accountName);
	await addDialog.getByRole("combobox").click();
	await page.getByRole("option", { name: "Investment", exact: true }).click();
	await addDialog.getByLabel(/Current Balance/).fill("0");
	await addDialog.getByRole("switch", { name: "Track Contribution Room" }).click();
	await addDialog.getByRole("combobox", { name: "Plan Type" }).click();
	await page.getByRole("option", { name: plan, exact: true }).click();
	const roomInput = addDialog.getByLabel(`Your ${plan} Room`);
	if (room) {
		await roomInput.fill(room);
	} else {
		// The plan room is shared, so a second account of the plan starts with it entered.
		await expect(roomInput).not.toHaveValue("");
	}
	await addDialog.getByRole("button", { name: /Create Account/ }).click();
	await expect(page.getByText("Account created successfully")).toBeVisible();
}

async function deposit(page: Page, amount: string) {
	const transactionDialog = page.getByRole("dialog", { name: "Add Transaction" });
	await openDialog(page.getByRole("button", { name: "Add Deposit" }), transactionDialog);
	await transactionDialog.getByLabel(/Amount/).fill(amount);
	return transactionDialog;
}

// Issue #121: registered-plan room belongs to the person, so every account of the plan shares
// one room derived from the ledger in PostgreSQL. Going over it only warns, never blocks.
test("accounts of one plan share contribution room and warn on an over-contribution", async ({ page }, testInfo) => {
	const plan = PLAN_BY_PROJECT[testInfo.project.name] ?? "TFSA";
	const firstName = uniqueName(`E2E ${plan} One`, testInfo.project.name);
	const secondName = uniqueName(`E2E ${plan} Two`, testInfo.project.name);

	await createRegisteredAccount(page, plan, firstName, "1000");
	await page.getByRole("link", { name: new RegExp(firstName) }).click();
	await expect(page).toHaveURL(/\/balancesheet\/accountdetail\//);

	const card = page.getByTestId("contribution-room-card");
	await expect(card.getByText("Lifetime room left")).toBeVisible();
	await expectNoHorizontalScroll(page);

	let dialog = await deposit(page, "600");
	await expect(dialog.getByTestId("contribution-room-warning")).toBeHidden();
	await dialog.getByLabel(/Description/).fill(`E2E first ${plan} contribution`);
	await dialog.getByRole("button", { name: "Add Transaction" }).click();
	await expect(page.getByText("Transaction added")).toBeVisible();
	// Wait for the card to refetch before leaving, so no request is cut off by the navigation.
	await expect(card.getByText("$600.00 used of $1,000.00", { exact: false })).toBeVisible();

	await createRegisteredAccount(page, plan, secondName);
	await page.getByRole("link", { name: new RegExp(secondName) }).click();
	await expect(page).toHaveURL(/\/balancesheet\/accountdetail\//);
	// The first account's deposit already used room shared with this account.
	await expect(card.getByText("$600.00 used of $1,000.00", { exact: false })).toBeVisible();

	dialog = await deposit(page, "600");
	await expect(dialog.getByTestId("contribution-room-warning")).toContainText(
		`$200.00 over your ${plan} contribution room`
	);
	await dialog.getByLabel(/Description/).fill(`E2E second ${plan} contribution`);
	await dialog.getByRole("button", { name: "Add Transaction" }).click();

	await expect(page.getByText("Transaction added")).toBeVisible();
	await expect(card.getByText("$1,200.00 used of $1,000.00", { exact: false })).toBeVisible();
	await expect(card.getByText(`Shared by your 2 ${plan} accounts`)).toBeVisible();
});
