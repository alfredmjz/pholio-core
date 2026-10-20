import { test, expect, openDialog, uniqueName } from "@/e2e/fixtures";

test(
	"frequency can be cleared while typing and is validated on submit",
	{ tag: "@smoke" },
	async ({ page }, testInfo) => {
		const name = uniqueName("E2E Rent", testInfo.project.name);

		await page.goto("/recurring");
		const dialog = page.getByRole("dialog", { name: "Add Recurring Expense" });
		await openDialog(page.getByRole("button", { name: /Add Recurring/ }), dialog);

		await dialog.getByText("Rent", { exact: true }).click();
		await dialog.getByPlaceholder("Netflix, Rent, etc.").fill(name);
		await dialog.getByPlaceholder("0.00").fill("1200");

		// Deleting the only digit used to snap back to "1".
		const frequency = dialog.getByLabel("Frequency");
		await frequency.click();
		await frequency.press("End");
		await frequency.press("Backspace");
		await expect(frequency).toHaveValue("");

		await dialog.getByRole("button", { name: /Add Expense/ }).click();
		await expect(page.getByText("Invalid frequency")).toBeVisible();
		await expect(dialog).toBeVisible();

		await frequency.pressSequentially("3");
		await expect(frequency).toHaveValue("3");
		await dialog.getByRole("button", { name: /Add Expense/ }).click();

		await expect(page.getByText("Recurring expense added")).toBeVisible();

		// Rent is a bill, listed under the Bills tab.
		await page.getByRole("tab", { name: "Bills" }).click();
		await expect(page.getByText(name).first()).toBeVisible();
	}
);
