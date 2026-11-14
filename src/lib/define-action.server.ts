import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { Logger } from "@/lib/logger";
import { ActionError, GENERIC_ACTION_ERROR, type ActionResult } from "@/lib/action-result";
import { getWriteContext, type DataContext } from "@/lib/data-context.server";

type Inputs<S extends z.ZodType[]> = { [K in keyof S]: z.input<S[K]> };
type Outputs<S extends z.ZodType[]> = { [K in keyof S]: z.output<S[K]> };

/**
 * A mutation callable from the client. Each positional argument is parsed by its schema, the
 * user is confirmed, and every outcome comes back as an ActionResult instead of a throw.
 * Throw ActionError for a failure the user should read; anything else is logged and genericised.
 *
 * Export the result from a "use server" file: `export const saveX = defineAction(...)`.
 */
export function defineAction<const S extends z.ZodType[], T>(
	name: string,
	schemas: S,
	handler: (ctx: DataContext, ...args: Outputs<S>) => Promise<T>
): (...args: Inputs<S>) => Promise<ActionResult<T>> {
	return async (...raw) => {
		const parsed: unknown[] = [];
		for (let i = 0; i < schemas.length; i++) {
			const result = schemas[i].safeParse(raw[i]);
			if (!result.success) {
				const issue = result.error.issues[0];
				Logger.warn(`${name}: invalid input`, { arg: i, issues: result.error.issues });
				return { ok: false, error: { code: "invalid_input", message: issue?.message ?? "Invalid input." } };
			}
			parsed.push(result.data);
		}

		const ctx = await getWriteContext();
		if (!ctx) return { ok: false, error: { code: "unauthorized", message: "Please sign in again." } };

		try {
			return { ok: true, data: await handler(ctx, ...(parsed as Outputs<S>)) };
		} catch (error) {
			unstable_rethrow(error);
			if (error instanceof ActionError) return { ok: false, error: { code: error.code, message: error.message } };
			Logger.error(`${name} failed`, { error });
			return { ok: false, error: { code: "failed", message: GENERIC_ACTION_ERROR } };
		}
	};
}
