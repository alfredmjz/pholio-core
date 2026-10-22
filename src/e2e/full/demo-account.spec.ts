import { test, expect, openDialog, uniqueName, SIGNED_OUT } from "@/e2e/fixtures";

test.use({ storageState: SIGNED_OUT });

// Demo accounts live only in the browser's demo store, so the server-rendered account page
// can't find them and must fall back to the store instead of redirecting.
test("demo: open a created account and record a deposit", async ({ page }, testInfo) => {
	const accountName = uniqueName("Demo Chequing", testInfo.project.name);

	await page.goto("/login");
	await page.getByRole("button", { name: "Try the demo" }).click();
	await expect(page).toHaveURL(/\/dashboard/);

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

	await page.getByRole("link", { name: new RegExp(accountName) }).click();
	await expect(page).toHaveURL(/\/accounts\/[\w-]+$/);
	await expect(page.getByRole("heading", { name: accountName, level: 1 })).toBeVisible();
	await expect(page.getByText("$1,000.00").first()).toBeVisible();

	const transactionDialog = page.getByRole("dialog", { name: "Add Transaction" });
	await openDialog(page.getByRole("button", { name: "Add Deposit" }), transactionDialog);
	await transactionDialog.getByLabel(/Amount/).fill("250");
	await transactionDialog.getByLabel(/Description/).fill("Demo deposit");
	await transactionDialog.getByRole("button", { name: "Add Transaction" }).click();

	await expect(page.getByText("Transaction added")).toBeVisible();
	await expect(page.getByText("$1,250.00").first()).toBeVisible();
	await expect(page.getByText("Demo deposit").first()).toBeVisible();

	// The demo store survives a reload, so the account page still opens from a direct link.
	const accountUrl = page.url();
	await page.reload();
	await expect(page).toHaveURL(accountUrl);
	await expect(page.getByRole("heading", { name: accountName, level: 1 })).toBeVisible();
	await expect(page.getByText("$1,250.00").first()).toBeVisible();

	// An id that is in neither the sample data nor the demo store still goes back.
	await page.goto("/accounts/does-not-exist");
	await expect(page).toHaveURL(/\/accounts$/);
});
