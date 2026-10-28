import { test, expect, openDialog, SIGNED_OUT } from "@/e2e/fixtures";
import { signInNewUser } from "@/e2e/support/users";

test.use({ storageState: SIGNED_OUT });

// Dropping a category wiggles only its own bar. The other rows move in the page, and must not
// replay their wave or shake.
test("dropping a category animates only the dropped row", async ({ page }, testInfo) => {
	test.slow();
	await signInNewUser(page, "drop-wiggle");

	await page.goto("/allocations");
	const setup = page.getByRole("dialog");
	await expect(setup.getByText("Start blank")).toBeVisible({ timeout: 20_000 });
	await setup.getByText("Start blank").click();
	await setup.getByLabel(/Expected income/).fill("1000");
	await setup.getByRole("button", { name: "Continue" }).click();
	await expect(page.getByText("Budget created!")).toBeVisible();

	for (const [name, budget] of [
		["E2E First", "100"],
		["E2E Second", "50"],
	]) {
		const add = page.getByRole("dialog", { name: "Add category" });
		await openDialog(page.getByRole("button", { name: "Add category" }), add);
		await add.getByLabel(/Name/).fill(name);
		await add.getByLabel(/Monthly budget/).fill(budget);
		await add.getByRole("button", { name: "Add category" }).click();
		await expect(page.getByRole("button", { name: `Reorder ${name}` })).toBeVisible();
	}
	// Let every bar finish rolling in first.
	await page.waitForTimeout(2_000);

	await page.getByRole("button", { name: "Reorder E2E Second" }).focus();
	await page.keyboard.press("Space");
	await page.waitForTimeout(300);
	await page.keyboard.press("ArrowUp");
	await page.waitForTimeout(300);
	await page.keyboard.press("Space");

	expect(await shakingRows(page)).toEqual(["E2E Second"]);
	await expect(page.getByRole("button", { name: /^Reorder / }).first()).toHaveAccessibleName("Reorder E2E Second");

	// Then with the mouse: drag First back above Second. Phones drag by touch, not a mouse.
	if (testInfo.project.name !== "desktop") return;
	await page.waitForTimeout(1_000);
	const from = await page.getByRole("button", { name: "Reorder E2E First" }).boundingBox();
	const to = await page.getByRole("button", { name: "Reorder E2E Second" }).boundingBox();
	await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
	await page.mouse.down();
	await page.mouse.move(to!.x + to!.width / 2, to!.y - 4, { steps: 12 });
	await page.mouse.up();

	expect(await shakingRows(page)).toEqual(["E2E First"]);
	await expect(page.getByRole("button", { name: /^Reorder / }).first()).toHaveAccessibleName("Reorder E2E First");
});

/** The rows whose wave or wiggle runs in the 2.5s after a drop. */
async function shakingRows(page: import("@playwright/test").Page): Promise<string[]> {
	// Every animation running in each row (CSS animations by name, transitions by property).
	const animated = await page.evaluate(async () => {
		const seen: Record<string, Set<string>> = {};
		const start = performance.now();
		while (performance.now() - start < 2_500) {
			for (const handle of Array.from(document.querySelectorAll('[aria-label^="Reorder "]'))) {
				const row = handle.closest("li");
				const name = handle.getAttribute("aria-label")!.replace("Reorder ", "");
				for (const animation of row?.getAnimations({ subtree: true }) ?? []) {
					const kind =
						"animationName" in animation
							? (animation as CSSAnimation).animationName
							: (animation as CSSTransition).transitionProperty;
					(seen[name] ??= new Set()).add(kind);
				}
			}
			await new Promise((resolve) => requestAnimationFrame(resolve));
		}
		return Object.fromEntries(Object.entries(seen).map(([name, kinds]) => [name, Array.from(kinds).sort()]));
	});

	console.log("animated rows after the drop:", JSON.stringify(animated));
	return Object.entries(animated)
		.filter(([, kinds]) => kinds.some((kind) => kind === "progress-wave" || kind === "progress-wiggle"))
		.map(([name]) => name);
}
