import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { AllocationPageData } from "@/app/allocations/types";

type PageDataRoute = typeof import("@/app/api/allocations/page-data/route");

const signedIn = { kind: "supabase", db: {}, userId: "user-1" } as const;
const demo = { kind: "demo", userId: "sample-user", session: "demo-1" } as const;
type Ctx = typeof signedIn | typeof demo;

const pageData: AllocationPageData = {
	summary: null,
	transactions: [
		{
			id: "tx-1",
			user_id: "user-1",
			name: "Groceries",
			amount: -42,
			transaction_date: "2026-11-02",
			source: "manual",
			created_at: "2026-11-02T10:00:00.000Z",
			updated_at: "2026-11-02T10:00:00.000Z",
		},
	],
	accounts: [],
	contributions: { pools: [], categoryPlans: {} },
};

const getReadContext = mock(async (): Promise<Ctx | null> => signedIn);
const loadAllocationPageData = mock(
	async (_ctx: Ctx, _allocationId: string | null, _year: number, _month: number) => pageData
);

mock.module("@/lib/data-context.server", () => ({ getReadContext }));
mock.module("@/app/allocations/page-data.server", () => ({ loadAllocationPageData }));

let GET: PageDataRoute["GET"];

beforeAll(async () => {
	// Import after mocking so the route picks up the stubs.
	({ GET } = await import("@/app/api/allocations/page-data/route"));
});

beforeEach(() => {
	getReadContext.mockClear();
	getReadContext.mockImplementation(async () => signedIn);
	loadAllocationPageData.mockClear();
});

const request = (query: string) => new Request(`https://pholio.test/api/allocations/page-data?${query}`);

describe("allocation page data route", () => {
	test("answers 401 JSON when nobody is signed in", async () => {
		getReadContext.mockImplementation(async () => null);
		const response = await GET(request("year=2026&month=11"));

		expect(response.status).toBe(401);
		expect(response.headers.get("content-type")).toContain("application/json");
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(loadAllocationPageData).not.toHaveBeenCalled();
	});

	test.each([
		["no parameters", ""],
		["a month out of range", "year=2026&month=13"],
		["a month of zero", "year=2026&month=0"],
		["a non-numeric year", "year=abc&month=11"],
		["a fractional month", "year=2026&month=1.5"],
		["a missing month", "year=2026"],
	])("answers 400 JSON for %s", async (_label, query) => {
		const response = await GET(request(query));

		expect(response.status).toBe(400);
		expect(await response.json()).toHaveProperty("error");
		expect(loadAllocationPageData).not.toHaveBeenCalled();
	});

	test("returns the page data for a signed-in user without caching it", async () => {
		const response = await GET(request("year=2026&month=11&allocationId=alloc-1"));

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.json()).toEqual(pageData);
		expect(loadAllocationPageData).toHaveBeenCalledWith(signedIn, "alloc-1", 2026, 11);
	});

	test("serves a demo visitor from the demo context, with no allocation for an empty month", async () => {
		getReadContext.mockImplementation(async () => demo);
		const response = await GET(request("year=2026&month=2&allocationId="));

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.json()).toEqual(pageData);
		expect(loadAllocationPageData).toHaveBeenCalledWith(demo, null, 2026, 2);
	});
});
