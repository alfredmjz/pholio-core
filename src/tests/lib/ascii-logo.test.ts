import { describe, expect, test } from "bun:test";
import {
	ANIMATION_STYLE,
	ICON_STYLE,
	LOGO_RAMP,
	STATIC_POSE,
	glyphGridSize,
	glyphShapes,
	logoChar,
	logoGlyphs,
	renderLogoGrid,
} from "@/lib/ascii-logo";

describe("logoChar", () => {
	test("shadowed and unlit faces draw a dot", () => {
		expect(logoChar(-0.6)).toBe(".");
		expect(logoChar(0)).toBe(".");
	});

	test("brighter faces draw heavier characters", () => {
		expect(logoChar(0.05)).toBe(".");
		expect(logoChar(0.5)).toBe("=");
		expect(logoChar(0.95)).toBe("@");
		expect(logoChar(1)).toBe("@");
		expect(LOGO_RAMP).toHaveLength(12);
	});
});

describe("renderLogoGrid", () => {
	// Facing the camera at size 46, one model unit is roughly one cell, centred on cell 23.
	const grid = renderLogoGrid(46, { yaw: 0, pitch: 0 });
	const isFilled = (col: number, row: number) => grid.filled[row * grid.size + col] === 1;

	test("draws the stem and the bowl", () => {
		expect(isFilled(15, 33)).toBe(true);
		expect(isFilled(31, 16)).toBe(true);
	});

	test("leaves the bowl's counter and the corners open", () => {
		expect(isFilled(23, 16)).toBe(false);
		expect(isFilled(0, 0)).toBe(false);
		expect(isFilled(45, 45)).toBe(false);
	});

	test("rings the counter in the accent and keeps the outer edge and stem in ink", () => {
		const firstFilled = (dx: number, dy: number) => {
			for (let col = 23, row = 16; col >= 0 && row >= 0 && col < 46 && row < 46; col += dx, row += dy) {
				if (isFilled(col, row)) return row * 46 + col;
			}
			return -1;
		};
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		]) {
			expect(grid.accent[firstFilled(dx, dy)]).toBe(1);
		}
		expect(grid.accent[5 * 46 + 23]).toBe(0);
		expect(grid.accent[33 * 46 + 15]).toBe(0);
	});

	test("lights the bowl's top edge more than its bottom edge", () => {
		const topEdge = grid.light[5 * 46 + 23];
		const bottomEdge = grid.light[26 * 46 + 23];
		expect(topEdge).toBeGreaterThan(0.8);
		expect(bottomEdge).toBeLessThan(0.4);
	});
});

describe("glyphGridSize", () => {
	test("gives small marks tight cells and large marks roomier ones", () => {
		expect(glyphGridSize(13)).toBe(6);
		expect(glyphGridSize(22)).toBe(10);
		expect(glyphGridSize(26)).toBe(12);
		expect(glyphGridSize(47)).toBe(16);
		expect(glyphGridSize(96)).toBe(24);
	});
});

describe("glyphShapes", () => {
	test("draws each character as its own simple shapes", () => {
		expect(glyphShapes(".", 0.5, 0.5, false)).toEqual([{ shape: "circle", x: 0.5, y: 0.65, r: 0.13, accent: false }]);
		expect(glyphShapes("=", 0.5, 0.5, false)).toHaveLength(2);
		expect(glyphShapes("*", 0.5, 0.5, false)).toHaveLength(2);
		expect(glyphShapes("#", 0.5, 0.5, false)).toHaveLength(4);
		expect(glyphShapes("@", 0.5, 0.5, true)).toEqual([{ shape: "circle", x: 0.5, y: 0.5, r: 0.4, accent: true }]);
	});

	test("keeps every shape inside its cell, at regular and icon weight", () => {
		for (const weight of [1, ICON_STYLE.weight]) {
			for (const char of LOGO_RAMP) {
				for (const glyph of glyphShapes(char, 0.5, 0.5, false, weight)) {
					if (glyph.shape === "circle") {
						expect(glyph.y - glyph.r).toBeGreaterThanOrEqual(0);
						expect(glyph.y + glyph.r).toBeLessThanOrEqual(1);
					} else {
						expect(glyph.x).toBeGreaterThanOrEqual(0);
						expect(glyph.y).toBeGreaterThanOrEqual(0);
						expect(glyph.x + glyph.width).toBeLessThanOrEqual(1);
						expect(glyph.y + glyph.height).toBeLessThanOrEqual(1);
					}
				}
			}
		}
	});

	test("thickens strokes and dots with weight, up to a cap", () => {
		const [regularDash] = glyphShapes("-", 0.5, 0.5, false, 1);
		const [heavyDash] = glyphShapes("-", 0.5, 0.5, false, 1.7);
		expect(regularDash.shape === "rect" && heavyDash.shape === "rect").toBe(true);
		if (regularDash.shape === "rect" && heavyDash.shape === "rect") {
			expect(heavyDash.height).toBeCloseTo(0.272);
			expect(heavyDash.height).toBeGreaterThan(regularDash.height);
		}
		expect(glyphShapes("@", 0.5, 0.5, false, 1.7)).toEqual([
			{ shape: "circle", x: 0.5, y: 0.5, r: 0.46, accent: false },
		]);
	});
});

describe("logoGlyphs", () => {
	test("draws the p inside the grid with some faces in the accent", () => {
		const glyphs = logoGlyphs(16);
		expect(glyphs.length).toBeGreaterThan(40);
		expect(glyphs.some((glyph) => glyph.accent)).toBe(true);
		for (const glyph of glyphs) {
			expect(glyph.x).toBeGreaterThanOrEqual(0);
			expect(glyph.y).toBeLessThanOrEqual(16);
		}
	});

	test("reuses the computed mark for the same grid", () => {
		expect(logoGlyphs(10)).toBe(logoGlyphs(10));
	});

	test("scatters the icon's green over the stem and the bowl", () => {
		const accentRows = logoGlyphs(16)
			.filter((glyph) => glyph.accent)
			.map((glyph) => glyph.y);
		expect(Math.min(...accentRows)).toBeLessThan(5);
		expect(Math.max(...accentRows)).toBeGreaterThan(11);
	});

	test("keeps the animation's green on the counter rim", () => {
		const { filled, accent } = renderLogoGrid(16, STATIC_POSE);
		const rimCells = new Set<string>();
		filled.forEach((isFilled, cell) => {
			if (isFilled && accent[cell]) rimCells.add(`${cell % 16},${Math.floor(cell / 16)}`);
		});
		const green = logoGlyphs(16, STATIC_POSE, ANIMATION_STYLE).filter((glyph) => glyph.accent);
		expect(green.length).toBeGreaterThan(0);
		for (const glyph of green) {
			expect(rimCells.has(`${Math.floor(glyph.x)},${Math.floor(glyph.y)}`)).toBe(true);
		}
	});

	test("turns with the pose", () => {
		const front = logoGlyphs(16, { yaw: 0, pitch: 0 });
		const turned = logoGlyphs(16, { yaw: 0.6, pitch: 0.3 });
		expect(front).not.toEqual(turned);
		expect(logoGlyphs(16, { yaw: 0, pitch: 0 })).toEqual(front);
	});
});
