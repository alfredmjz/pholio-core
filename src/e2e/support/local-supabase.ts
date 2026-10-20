import { execSync } from "node:child_process";
import path from "node:path";

/** Connection details for the local Supabase stack started with `supabase start`. */
export type LocalSupabase = {
	url: string;
	publishableKey: string;
	secretKey: string;
	mailpitUrl: string;
};

const SRC_DIR = path.resolve(__dirname, "../..");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Throws unless the URL points at this machine. The suite creates users and data, so it must
 * never run against a hosted Supabase project.
 */
export function assertLocalUrl(url: string) {
	const { hostname } = new URL(url);
	if (!LOCAL_HOSTS.has(hostname)) {
		throw new Error(`E2E tests only run against a local Supabase. Refusing to use ${url}.`);
	}
}

/**
 * Reads the local Supabase connection from `supabase status` once and caches it in
 * `process.env`, so Playwright workers (which inherit the env) skip the CLI call.
 */
export function loadLocalSupabase(): LocalSupabase {
	if (!process.env.E2E_SUPABASE_URL) {
		let status: Record<string, string>;
		try {
			const output = execSync("bunx supabase status -o json --workdir ..", {
				cwd: SRC_DIR,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			});
			status = JSON.parse(output.slice(output.indexOf("{")));
		} catch {
			throw new Error("Local Supabase is not running. Start Docker Desktop, then run `bun run e2e:db` from src/.");
		}

		process.env.E2E_SUPABASE_URL = status.API_URL;
		process.env.E2E_SUPABASE_PUBLISHABLE_KEY = status.PUBLISHABLE_KEY;
		process.env.E2E_SUPABASE_SECRET_KEY = status.SECRET_KEY;
		process.env.E2E_MAILPIT_URL = status.MAILPIT_URL ?? status.INBUCKET_URL;
	}

	const local: LocalSupabase = {
		url: process.env.E2E_SUPABASE_URL!,
		publishableKey: process.env.E2E_SUPABASE_PUBLISHABLE_KEY!,
		secretKey: process.env.E2E_SUPABASE_SECRET_KEY!,
		mailpitUrl: process.env.E2E_MAILPIT_URL!,
	};

	assertLocalUrl(local.url);
	return local;
}
