import { test, expect, SIGNED_OUT } from "@/e2e/fixtures";
import { adminClient, signInNewUser } from "@/e2e/support/users";

test.use({ storageState: SIGNED_OUT });

// A transaction saved elsewhere (another tab or device) shows up when the user comes back to the
// Allocations page: one request refetches summary, transactions, accounts and contributions, and
// only once the data is a minute old.
test("coming back to Allocations picks up changes made elsewhere with one refetch", async ({ page }, testInfo) => {
	const userId = await signInNewUser(page, `alloc-sync-${testInfo.project.name}`);
	const admin = adminClient();
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;

	const { data: allocation, error: allocationError } = await admin
		.from("allocations")
		.insert({ user_id: userId, year, month, expected_income: 3000 })
		.select("id")
		.single();
	expect(allocationError).toBeNull();
	const { data: category, error: categoryError } = await admin
		.from("allocation_categories")
		.insert({ allocation_id: allocation!.id, user_id: userId, name: "Groceries", budget_cap: 400, display_order: 0 })
		.select("id")
		.single();
	expect(categoryError).toBeNull();

	await page.clock.install();
	await page.goto(`/allocations?year=${year}&month=${month}`);
	await expect(page.getByText("Groceries").first()).toBeVisible();
	await page.waitForLoadState("networkidle");

	const actionPosts: string[] = [];
	page.on("request", (request) => {
		if (request.method() === "POST" && request.headers()["next-action"]) actionPosts.push(request.url());
	});
	const comeBack = () =>
		page.evaluate(() => {
			window.dispatchEvent(new Event("focus"));
			document.dispatchEvent(new Event("visibilitychange"));
		});

	const name = `Grocery run from another device ${Date.now()}`;
	const { error: transactionError } = await admin.from("transactions").insert({
		user_id: userId,
		category_id: category!.id,
		name,
		amount: 42,
		transaction_date: `${year}-${String(month).padStart(2, "0")}-01`,
	});
	expect(transactionError).toBeNull();

	// The ledger renders a table row and a mobile card; only one of them is shown.
	const newRow = page.getByText(name).filter({ visible: true });

	// Within a minute of loading, coming back does not refetch.
	await comeBack();
	await page.clock.runFor(1_000);
	expect(actionPosts).toHaveLength(0);
	await expect(newRow).toHaveCount(0);

	await page.clock.fastForward("01:00");
	await comeBack();
	await expect(newRow).toBeVisible();
	expect(actionPosts).toHaveLength(1);
});
