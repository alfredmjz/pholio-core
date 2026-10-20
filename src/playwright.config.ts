import { defineConfig, devices } from "@playwright/test";
import { loadLocalSupabase } from "./e2e/support/local-supabase";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const AUTH_FILE = "e2e/.auth/user.json";
const isCI = !!process.env.CI;

const supabase = loadLocalSupabase();

/**
 * End-to-end suite. See docs/e2e-testing-spec.md.
 *
 * Builds the app into `.next-e2e` against the local Supabase and serves it on :3100, so it
 * never touches `bun run dev` (:3000) or a hosted database.
 */
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: isCI ? 2 : undefined,
	reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
	expect: { timeout: 10_000 },
	use: {
		baseURL: BASE_URL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{ name: "setup", testMatch: /auth\.setup\.ts/ },
		{
			name: "desktop",
			use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: AUTH_FILE },
			dependencies: ["setup"],
		},
		{
			name: "android",
			use: { ...devices["Pixel 7"], storageState: AUTH_FILE },
			dependencies: ["setup"],
		},
		{
			name: "iphone",
			use: { ...devices["iPhone 13 Mini"], storageState: AUTH_FILE },
			dependencies: ["setup"],
		},
	],
	webServer: {
		command: `bun run build && bun run start --port ${PORT}`,
		url: `${BASE_URL}/login`,
		reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
		timeout: 300_000,
		stdout: "ignore",
		stderr: "pipe",
		env: {
			NEXT_DIST_DIR: ".next-e2e",
			NEXT_PUBLIC_USE_SAMPLE_DATA: "false",
			NEXT_PUBLIC_SITE_URL: BASE_URL,
			NEXT_PUBLIC_SUPABASE_URL: supabase.url,
			NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
			SUPABASE_SECRET_KEY: supabase.secretKey,
		},
	},
});
