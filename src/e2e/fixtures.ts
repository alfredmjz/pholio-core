import { test as base, expect, type Locator, type Page } from "@playwright/test";

/**
 * Same-origin routes that proxy third-party services. They return 503 when the service is not
 * configured (e.g. no logo.dev token in CI), which is not an app failure.
 */
const EXTERNAL_PROXY_PATHS = ["/api/logos/"];

/**
 * Browser noise reported as uncaught errors that never affects the user:
 * - WebKit reports any same-origin request cancelled by a navigation or redirect (route
 *   prefetches with `?_rsc=`, and server-action POSTs to the page being left) as an
 *   "access control checks" error.
 * - "ResizeObserver loop" is a benign notice when a chart resizes during layout.
 */
function isBenignBrowserError(message: string) {
	return message.includes("due to access control checks") || message.startsWith("ResizeObserver loop");
}

/**
 * Shared test with an automatic guard: any uncaught page error or same-origin 5xx response
 * during a test fails it, so a page that crashes on render can't pass silently.
 */
export const test = base.extend<{ pageProblems: string[] }>({
	pageProblems: [
		async ({ page, baseURL }, use) => {
			const problems: string[] = [];
			page.on("pageerror", (error) => {
				if (!isBenignBrowserError(error.message)) problems.push(`Uncaught error: ${error.message}`);
			});
			page.on("response", (response) => {
				const url = response.url();
				if (!baseURL || !url.startsWith(baseURL) || response.status() < 500) return;
				if (EXTERNAL_PROXY_PATHS.some((path) => new URL(url).pathname.startsWith(path))) return;
				problems.push(`${response.status()} from ${url}`);
			});

			await use(problems);

			expect(problems, "page errors or server errors during the test").toEqual([]);
		},
		{ auto: true },
	],
});

export { expect };

/** Signed-out browser state, for tests of public pages. */
export const SIGNED_OUT = { cookies: [], origins: [] };

/**
 * Clicks a trigger until the dialog it opens is visible. A click that lands before the page
 * has hydrated does nothing, which happens under parallel load.
 */
export async function openDialog(trigger: Locator, dialog: Locator) {
	await expect(async () => {
		await trigger.click();
		await expect(dialog).toBeVisible({ timeout: 2_000 });
	}).toPass({ timeout: 20_000 });
}

/** The bottom tab bar and top bar replace the sidebar below Tailwind's `lg` breakpoint. */
export function isMobileLayout(page: Page) {
	return (page.viewportSize()?.width ?? 1440) < 1024;
}

/**
 * Fails if the page scrolls sideways, naming the widest elements that stick out so the
 * failure points at the culprit.
 */
export async function expectNoHorizontalScroll(page: Page) {
	const result = await page.evaluate(() => {
		const viewportWidth = document.documentElement.clientWidth;
		const overflowing: string[] = [];

		for (const element of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
			const rect = element.getBoundingClientRect();
			if (rect.width === 0 || rect.right <= viewportWidth + 1) continue;
			const label = element.id
				? `#${element.id}`
				: (element.getAttribute("class") ?? "").split(" ").slice(0, 3).join(".");
			overflowing.push(`<${element.tagName.toLowerCase()}> ${label} (right edge ${Math.round(rect.right)}px)`);
			if (overflowing.length === 5) break;
		}

		return { scrollWidth: document.documentElement.scrollWidth, viewportWidth, overflowing };
	});

	expect(
		result.scrollWidth,
		`page is ${result.scrollWidth}px wide in a ${result.viewportWidth}px viewport. Overflowing: ${result.overflowing.join(", ")}`
	).toBeLessThanOrEqual(result.viewportWidth);
}

/** A name that is unique per project and run, so parallel projects never collide. */
export function uniqueName(prefix: string, projectName: string) {
	return `${prefix} ${projectName} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
