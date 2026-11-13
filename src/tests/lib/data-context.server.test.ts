import { beforeAll, describe, expect, test } from "bun:test";
import { mockModule } from "@/tests/support/mock-module";

type DataContextModule = typeof import("@/lib/data-context.server");

let demoSlice: DataContextModule["demoSlice"];

beforeAll(async () => {
	await mockModule("@/lib/supabase/server", { createClient: async () => ({}), getReadUserId: async () => null });
	await mockModule("@/lib/demo-mode.server", { getSampleDataSessionKey: async () => null });
	({ demoSlice } = await import("@/lib/data-context.server"));
});

const demo = (session: string) => ({ kind: "demo", userId: "sample-user", session }) as const;

describe("demoSlice", () => {
	test("seeds once and returns the same state for the same session", () => {
		let seeds = 0;
		const seed = () => {
			seeds++;
			return { items: [1] };
		};

		const first = demoSlice(demo("a"), "items", seed);
		first.items.push(2);

		expect(demoSlice(demo("a"), "items", seed).items).toEqual([1, 2]);
		expect(seeds).toBe(1);
	});

	test("keeps each demo session's changes apart", () => {
		demoSlice(demo("b"), "list", () => ["seed"]).push("b's change");

		expect(demoSlice(demo("c"), "list", () => ["seed"])).toEqual(["seed"]);
	});
});
