import { describe, expect, test } from "bun:test";
import { buildBudgetPlan } from "@/app/allocations/budget-plan";

describe("buildBudgetPlan", () => {
	test("splits income into budgets and an unbudgeted remainder", () => {
		const plan = buildBudgetPlan(5000, [
			{ id: "rent", name: "Rent", budget: 2000, spent: 2000 },
			{ id: "food", name: "Food", budget: 800, spent: 450 },
			{ id: "fun", name: "Fun", budget: 200, spent: 250 },
			{ id: "none", name: "Uncategorized", budget: 0, spent: 120 },
		]);

		expect(plan.budgeted).toBe(3000);
		// 2000 + 450 + 250 budgeted spend, plus 120 with no budget
		expect(plan.spent).toBe(2820);
		// Left per category: 0 + 350 + 0 (fun's overspend doesn't reduce food's room)
		expect(plan.leftInBudget).toBe(350);
		expect(plan.overBudget).toBe(50);
		expect(plan.notBudgeted).toBe(2000);
		expect(plan.overAllocated).toBe(false);
		expect(plan.unbudgetedSpent).toBe(120);

		expect(plan.segments.map((s) => [s.id, s.widthPercent, s.fillPercent, s.overBy])).toEqual([
			["rent", 40, 100, 0],
			["food", 16, 56.25, 0],
			["fun", 4, 100, 50],
		]);
		// 2000 of 5000 left unbudgeted, 120 of it spent
		expect(plan.remainder.widthPercent).toBe(40);
		expect(plan.remainder.fillPercent).toBe(6);
	});

	test("segments run from the biggest budget to the smallest, ties in category order", () => {
		const plan = buildBudgetPlan(1000, [
			{ id: "bills", name: "Bills", budget: 120, spent: 60 },
			{ id: "test", name: "Test", budget: 123, spent: 66 },
			{ id: "fun", name: "Fun", budget: 50, spent: 0 },
			{ id: "gym", name: "Gym", budget: 50, spent: 0 },
		]);
		expect(plan.segments.map((s) => s.id)).toEqual(["test", "bills", "fun", "gym"]);
	});

	test("an over-allocated month scales the ribbon to the budgets", () => {
		const plan = buildBudgetPlan(3000, [
			{ id: "a", name: "A", budget: 2500, spent: 0 },
			{ id: "b", name: "B", budget: 1500, spent: 0 },
		]);
		expect(plan.overAllocated).toBe(true);
		expect(plan.notBudgeted).toBe(-1000);
		expect(plan.segments.map((s) => s.widthPercent)).toEqual([62.5, 37.5]);
		expect(plan.remainder).toEqual({ widthPercent: 0, fillPercent: 0 });
	});

	test("a zero-budget category's spending counts as unbudgeted", () => {
		const plan = buildBudgetPlan(1000, [{ id: "gifts", name: "Gifts", budget: 0, spent: 80 }]);
		expect(plan.segments).toEqual([]);
		expect(plan.unbudgetedSpent).toBe(80);
		expect(plan.remainder.fillPercent).toBe(8);
	});

	test("no income and no budgets", () => {
		const plan = buildBudgetPlan(0, []);
		expect(plan.segments).toEqual([]);
		expect(plan.remainder).toEqual({ widthPercent: 0, fillPercent: 0 });
		expect(plan.notBudgeted).toBe(0);
	});
});
