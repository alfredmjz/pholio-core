import { cache } from "react";
import { createClient, getReadUserId } from "@/lib/supabase/server";
import { getSampleDataSessionKey } from "@/lib/demo-mode.server";
import { DEMO_COOKIE_MAX_AGE } from "@/lib/demo-mode";

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const DEMO_USER_ID = "sample-user";

export type SupabaseContext = { kind: "supabase"; db: SupabaseServerClient; userId: string };
export type DemoContext = { kind: "demo"; userId: typeof DEMO_USER_ID; session: string };

/** Who is asking and which data source answers. Stores pick their adapter from `kind`. */
export type DataContext = SupabaseContext | DemoContext;

async function demoContext(): Promise<DemoContext | null> {
	const session = await getSampleDataSessionKey();
	return session ? { kind: "demo", userId: DEMO_USER_ID, session } : null;
}

/** For reads: the JWT is verified locally (getClaims); RLS still guards every row. */
export const getReadContext = cache(async (): Promise<DataContext | null> => {
	const demo = await demoContext();
	if (demo) return demo;
	const db = await createClient();
	const userId = await getReadUserId(db);
	return userId ? { kind: "supabase", db, userId } : null;
});

/** For writes: the user is confirmed with Supabase Auth on every call. */
export async function getWriteContext(): Promise<DataContext | null> {
	const demo = await demoContext();
	if (demo) return demo;
	const db = await createClient();
	const { data } = await db.auth.getUser();
	return data.user ? { kind: "supabase", db, userId: data.user.id } : null;
}

const DEMO_STATE_TTL_MS = DEMO_COOKIE_MAX_AGE * 1000;
type DemoSessions = Map<string, { slices: Map<string, unknown>; touchedAt: number }>;

// On globalThis because Next can load this module more than once (route bundles, dev recompiles),
// and each copy would otherwise start an empty store.
const demoGlobal = globalThis as typeof globalThis & { __pholioDemoSessions?: DemoSessions };
const demoSessions: DemoSessions = (demoGlobal.__pholioDemoSessions ??= new Map());

/**
 * One demo visitor's in-memory copy of a feature's data, created from `seed` on first use.
 * State lives in this server instance only and is dropped once the demo session would have expired.
 */
export function demoSlice<T>(ctx: DemoContext, name: string, seed: () => T): T {
	const now = Date.now();
	demoSessions.forEach((entry, key) => {
		if (now - entry.touchedAt > DEMO_STATE_TTL_MS) demoSessions.delete(key);
	});

	let entry = demoSessions.get(ctx.session);
	if (!entry) {
		entry = { slices: new Map(), touchedAt: now };
		demoSessions.set(ctx.session, entry);
	}
	entry.touchedAt = now;

	if (!entry.slices.has(name)) entry.slices.set(name, seed());
	return entry.slices.get(name) as T;
}
