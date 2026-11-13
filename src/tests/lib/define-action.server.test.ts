import { afterAll, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mockModule } from "@/tests/support/mock-module";
import { ActionError, GENERIC_ACTION_ERROR } from "@/lib/action-result";
import { Logger } from "@/lib/logger";

type DefineAction = typeof import("@/lib/define-action.server").defineAction;

const ctx = { kind: "demo", userId: "sample-user", session: "s1" } as const;
const getWriteContext = mock(async (): Promise<typeof ctx | null> => ctx);
const logError = spyOn(Logger, "error").mockImplementation(() => {});
const logWarn = spyOn(Logger, "warn").mockImplementation(() => {});

let defineAction: DefineAction;

beforeAll(async () => {
	await mockModule("@/lib/data-context.server", { getWriteContext });
	({ defineAction } = await import("@/lib/define-action.server"));
});

beforeEach(() => {
	getWriteContext.mockClear();
	getWriteContext.mockImplementation(async () => ctx);
	logError.mockClear();
});

afterAll(() => {
	logError.mockRestore();
	logWarn.mockRestore();
});

describe("defineAction", () => {
	test("passes parsed positional arguments and the context to the handler", async () => {
		const handler = mock(async (_ctx: unknown, id: string, amount: number) => `${id}:${amount}`);
		const action = defineAction("test", [z.string(), z.number()], handler);

		expect(await action("acc-1", 25)).toEqual({ ok: true, data: "acc-1:25" });
		expect(handler).toHaveBeenCalledWith(ctx, "acc-1", 25);
	});

	test("rejects invalid input before checking the user or running the handler", async () => {
		const handler = mock(async () => "never");
		const action = defineAction("test", [z.number().positive("Amount must be positive.")], handler);

		expect(await action(-5)).toEqual({
			ok: false,
			error: { code: "invalid_input", message: "Amount must be positive." },
		});
		expect(handler).not.toHaveBeenCalled();
		expect(getWriteContext).not.toHaveBeenCalled();
	});

	test("accepts a missing trailing argument when its schema is optional", async () => {
		const action = defineAction("test", [z.string(), z.number().optional()], async (_ctx, id, limit) => [id, limit]);

		expect(await (action as (...args: unknown[]) => Promise<unknown>)("acc-1")).toEqual({
			ok: true,
			data: ["acc-1", undefined],
		});
	});

	test("returns unauthorized when nobody is signed in", async () => {
		getWriteContext.mockImplementation(async () => null);
		const handler = mock(async () => "never");

		const result = await defineAction("test", [], handler)();

		expect(result).toEqual({ ok: false, error: { code: "unauthorized", message: "Please sign in again." } });
		expect(handler).not.toHaveBeenCalled();
	});

	test("passes an ActionError's code and message through", async () => {
		const action = defineAction("test", [], async () => {
			throw new ActionError("not_found", "That account no longer exists.");
		});

		expect(await action()).toEqual({
			ok: false,
			error: { code: "not_found", message: "That account no longer exists." },
		});
		expect(logError).not.toHaveBeenCalled();
	});

	test("logs any other error and returns the generic message", async () => {
		const action = defineAction("test", [], async () => {
			throw new Error("duplicate key value violates unique constraint");
		});

		expect(await action()).toEqual({ ok: false, error: { code: "failed", message: GENERIC_ACTION_ERROR } });
		expect(logError).toHaveBeenCalledTimes(1);
	});

	test("rethrows Next.js redirects instead of turning them into results", async () => {
		const action = defineAction("test", [], async () => redirect("/login"));

		await expect(action()).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT/) });
	});
});
