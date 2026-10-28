import { test, expect, openDialog, uniqueName } from "@/e2e/fixtures";

// Paying bills early records every one today, so a bill due next month still lands in this
// month's budget, and the due date moves past the bills covered.
test("paying two bills early records both today", async ({ page }, testInfo) => {
	test.slow();
	const name = uniqueName("E2E Gym", testInfo.project.name);

	await page.goto("/recurring");
	const addBill = page.getByRole("dialog", { name: "Add Recurring Expense" });
	await openDialog(page.getByRole("button", { name: /Add recurring/i }), addBill);
	await addBill.getByText("Bill", { exact: true }).click();
	await addBill.getByPlaceholder("Netflix, Rent, etc.").fill(name);
	await addBill.getByPlaceholder("0.00").fill("45");
	await addBill.getByLabel("Auto-pay").click();
	await addBill.getByRole("button", { name: /Add Expense/ }).click();
	await expect(page.getByText("Recurring expense added")).toBeVisible();

	const billRow = page.getByRole("list", { name: "Bills" }).getByRole("listitem").filter({ hasText: name });
	await billRow.getByRole("button", { name: `More actions for ${name}` }).click();
	const payEarly = page.getByRole("dialog", { name: "Pay bills early" });
	await page.getByRole("menuitem", { name: "Pay bills early" }).click();
	await expect(payEarly).toBeVisible();

	await payEarly.getByRole("button", { name: "One more bill" }).click();
	await expect(payEarly.getByRole("list", { name: "Bills covered" }).getByRole("listitem")).toHaveCount(2);
	await payEarly.getByRole("button", { name: /Pay \$90\.00/ }).click();
	await expect(page.getByText("Paid 2 bills early")).toBeVisible();
	// Only the bill due this month counts toward it; next month's is counted when it comes due.
	await page.reload();
	await expect(billRow.getByText("1 of 1 paid this month")).toBeVisible();

	await page.goto("/allocations");
	await expect(page.getByText(name).filter({ visible: true })).toHaveCount(2, { timeout: 20_000 });
});
