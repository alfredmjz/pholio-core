import { beforeAll, describe, expect, mock, test } from "bun:test";

type StoreModule = typeof import("@/app/allocations/allocation-store");

mock.module("@/lib/supabase/server", () => ({ createClient: async () => ({}), getReadUserId: async () => null }));
mock.module("@/lib/demo-mode.server", () => ({ getSampleDataSessionKey: async () => null }));
mock.module("@/app/settings/actions", () => ({
	getAllocationSettings: async () => ({ newMonthDefault: "template", defaultTemplateId: null }),
	getTimezone: async () => null,
}));

let allocationStore: StoreModule["allocationStore"];

beforeAll(async () => {
	({ allocationStore } = await import("@/app/allocations/allocation-store"));
});

const demo = (session: string) => ({ kind: "demo", userId: "sample-user", session }) as const;

describe("demo allocation store", () => {
	test("every month has its own populated budget with that month's transactions", async () => {
		const store = allocationStore(demo("months"));
		const october = await store.find(2026, 10);
		const november = await store.find(2026, 11);

		expect(october?.id).toBe("sample-allocation-2026-10");
		expect(november?.id).toBe("sample-allocation-2026-11");

		const summary = await store.getSummary(november!.id);
		expect(summary?.allocation).toMatchObject({ year: 2026, month: 11 });
		expect(summary?.categories.every((c) => c.allocation_id === november!.id)).toBe(true);

		const transactions = await store.listTransactionsForMonth(2026, 11);
		expect(transactions.length).toBeGreaterThan(0);
		expect(transactions.every((t) => new Date(t.transaction_date).getMonth() + 1 === 11)).toBe(true);
	});

	test("summary totals follow the categories and expected income", async () => {
		const store = allocationStore(demo("totals"));
		const allocation = await store.findOrCreate(2026, 11, 0);
		await store.updateExpectedIncome(allocation.id, 6000);

		const summary = (await store.getSummary(allocation.id))!;
		const budget = summary.categories.reduce((sum, c) => sum + c.budget_cap, 0);
		expect(summary.allocation.expected_income).toBe(6000);
		expect(summary.summary.total_budget_caps).toBe(budget);
		expect(summary.summary.unallocated_funds).toBe(6000 - budget);
	});

	test("category edits stay within the visitor's demo session", async () => {
		const store = allocationStore(demo("edits"));
		const allocation = await store.findOrCreate(2026, 11, 0);
		const created = await store.createCategory({
			allocationId: allocation.id,
			name: "Pets",
			budgetCap: 120,
			isRecurring: false,
			contributionPlan: null,
		});
		await store.updateCategory("cat-food", { budget_cap: 900, name: "Food" });
		await store.deleteCategory("cat-entertainment");

		const categories = (await store.getSummary(allocation.id))!.categories;
		expect(categories.find((c) => c.id === created.id)).toMatchObject({ name: "Pets", budget_cap: 120 });
		expect(categories.find((c) => c.id === "cat-food")).toMatchObject({ name: "Food", budget_cap: 900 });
		expect(categories.some((c) => c.id === "cat-entertainment")).toBe(false);

		const other = (await allocationStore(demo("someone-else")).getSummary(allocation.id))!.categories;
		expect(other.some((c) => c.name === "Pets")).toBe(false);
		expect(other.some((c) => c.id === "cat-entertainment")).toBe(true);
	});

	test("a saved template lists and applies only the categories a month is missing", async () => {
		const store = allocationStore(demo("templates"));
		const november = await store.findOrCreate(2026, 11, 0);
		await store.createCategory({
			allocationId: november.id,
			name: "Gifts",
			budgetCap: 50,
			isRecurring: false,
			contributionPlan: null,
		});
		const template = await store.createTemplate(november.id, "My month");

		const [listed] = await store.listTemplates();
		expect(listed).toMatchObject({ id: template.id, name: "My month" });

		const december = await store.findOrCreate(2026, 12, 0);
		const before = (await store.getSummary(december.id))!.categories.length;
		await store.applyTemplate(template.id, december.id);
		const after = (await store.getSummary(december.id))!.categories;

		expect(after).toHaveLength(before + 1);
		expect(after.filter((c) => c.name === "Gifts")).toHaveLength(1);
	});

	test("an unknown allocation id has no summary", async () => {
		expect(await allocationStore(demo("unknown")).getSummary("not-a-demo-id")).toBeNull();
	});
});
