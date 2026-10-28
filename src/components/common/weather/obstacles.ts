/**
 * Where the page's sheets sit, so the weather can flow around them instead of across them.
 *
 * Sheets have their own background; everything else (text, buttons, graphs) sits straight on the
 * backdrop and the weather runs behind it, fading softly under each line of text so the words stay
 * readable. Sheets are read from the layout, padded a little, and drawn into a coarse grid. A
 * distance field over that grid tells clouds and debris how close the nearest sheet is and which
 * way is clear. The tops of sheets, and the lines drawn in charts, are also kept as surfaces that
 * rain lands and splashes on.
 */

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Point {
	x: number;
	y: number;
}

export interface Obstacles {
	rects: Rect[];
	/** Lines of text outside sheets. */
	halos: Rect[];
	/** Lines drawn in charts, as points in the canvas's coordinates. */
	lines: Point[][];
}

const CHART_SIZE = 120;
/** Pixels between samples along a chart line. */
const LINE_SAMPLE = 6;
/** Width of the columns rain checks for a surface to land on. */
const LANDING_STEP = 3;
const SHEET_PADDING = 4;
/** Rings around a line of text, outermost first: how far each reaches and how much of the weather it takes away. */
const HALO_RINGS = [
	{ padding: 7, fade: 0.35 },
	{ padding: 3, fade: 0.4 },
	{ padding: 0, fade: 0.45 },
];
const CELL = 8;
const FAR = 1e6;

function inside(element: Element | null, selector: string): boolean {
	return Boolean(element?.parentElement?.closest(selector));
}

// Sampled once per path shape, in the chart's own coordinates; only the position on screen changes.
const lineCache = new WeakMap<SVGGeometryElement, { d: string | null; points: DOMPoint[] }>();

function isOutline(shape: Element): boolean {
	const style = getComputedStyle(shape);
	const filled = style.fill !== "none" && style.fill !== "transparent" && !style.fill.endsWith(", 0)");
	return style.stroke !== "none" && !filled;
}

function chartLines(svg: SVGSVGElement, origin: DOMRect): Point[][] {
	const lines: Point[][] = [];
	svg.querySelectorAll<SVGGeometryElement>("path, polyline, line").forEach((shape) => {
		if (typeof shape.getTotalLength !== "function" || !isOutline(shape)) return;
		const matrix = shape.getScreenCTM();
		if (!matrix) return;
		const d = shape.getAttribute("d") ?? shape.getAttribute("points");
		let cached = lineCache.get(shape);
		if (!cached || cached.d !== d) {
			const total = shape.getTotalLength();
			const steps = Math.min(400, Math.ceil(total / LINE_SAMPLE));
			const points =
				total > 0 ? Array.from({ length: steps + 1 }, (_, i) => shape.getPointAtLength((total * i) / steps)) : [];
			cached = { d, points };
			lineCache.set(shape, cached);
		}
		if (cached.points.length < 2) return;
		lines.push(
			cached.points.map((point) => {
				const screen = point.matrixTransform(matrix);
				return { x: screen.x - origin.left, y: screen.y - origin.top };
			})
		);
	});
	return lines;
}

/** Sheets as padded boxes, lines of text and chart lines outside sheets, in the canvas's coordinates. */
export function collectObstacles(root: Element, origin: DOMRect): Obstacles {
	const rects: Rect[] = [];
	const halos: Rect[] = [];
	const lines: Point[][] = [];
	const add = (to: Rect[], rect: DOMRect, padding: number) => {
		if (rect.width < 1 || rect.height < 1) return;
		if (rect.bottom < origin.top || rect.top > origin.bottom || rect.right < origin.left || rect.left > origin.right)
			return;
		to.push({
			x: rect.left - origin.left - padding,
			y: rect.top - origin.top - padding,
			w: rect.width + padding * 2,
			h: rect.height + padding * 2,
		});
	};

	root.querySelectorAll(".surface-sheet").forEach((sheet) => {
		if (!inside(sheet, ".surface-sheet")) add(rects, sheet.getBoundingClientRect(), SHEET_PADDING);
	});

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (!node.textContent?.trim() || node.parentElement?.closest(".surface-sheet")) continue;
		range.selectNodeContents(node);
		for (const rect of Array.from(range.getClientRects())) add(halos, rect, 0);
	}

	// A chart is mostly empty space around a thin line: only the line itself is a surface.
	root.querySelectorAll<SVGSVGElement>("svg").forEach((svg) => {
		if (inside(svg, ".surface-sheet")) return;
		const rect = svg.getBoundingClientRect();
		if (rect.width > CHART_SIZE && rect.height > CHART_SIZE) lines.push(...chartLines(svg, origin));
	});
	return { rects, halos, lines };
}

export class ObstacleField {
	rects: Rect[] = [];
	halos: Rect[] = [];
	private cols = 0;
	private rows = 0;
	private distance = new Float32Array(0);
	/** For each narrow column of the page, the heights of the surfaces in it. */
	private landings: number[][] = [];

	update({ rects, halos, lines }: Obstacles, width: number, height: number) {
		this.rects = rects;
		this.halos = halos;
		this.buildLandings(rects, lines, width);
		this.cols = Math.ceil(width / CELL) + 1;
		this.rows = Math.ceil(height / CELL) + 1;
		const size = this.cols * this.rows;
		if (this.distance.length !== size) this.distance = new Float32Array(size);
		this.distance.fill(FAR);

		for (const rect of rects) {
			const left = Math.max(0, Math.floor(rect.x / CELL));
			const right = Math.min(this.cols - 1, Math.floor((rect.x + rect.w) / CELL));
			const top = Math.max(0, Math.floor(rect.y / CELL));
			const bottom = Math.min(this.rows - 1, Math.floor((rect.y + rect.h) / CELL));
			for (let row = top; row <= bottom; row++)
				this.distance.fill(0, row * this.cols + left, row * this.cols + right + 1);
		}

		// Two-pass chamfer distance, in cells: straight steps cost 1, diagonal ones √2.
		const d = this.distance;
		const { cols, rows } = this;
		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const i = row * cols + col;
				if (col > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
				if (row > 0) {
					d[i] = Math.min(d[i], d[i - cols] + 1);
					if (col > 0) d[i] = Math.min(d[i], d[i - cols - 1] + Math.SQRT2);
					if (col < cols - 1) d[i] = Math.min(d[i], d[i - cols + 1] + Math.SQRT2);
				}
			}
		}
		for (let row = rows - 1; row >= 0; row--) {
			for (let col = cols - 1; col >= 0; col--) {
				const i = row * cols + col;
				if (col < cols - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
				if (row < rows - 1) {
					d[i] = Math.min(d[i], d[i + cols] + 1);
					if (col < cols - 1) d[i] = Math.min(d[i], d[i + cols + 1] + Math.SQRT2);
					if (col > 0) d[i] = Math.min(d[i], d[i + cols - 1] + Math.SQRT2);
				}
			}
		}
	}

	private buildLandings(rects: Rect[], lines: Point[][], width: number) {
		const columns = Math.ceil(width / LANDING_STEP) + 1;
		this.landings = Array.from({ length: columns }, () => []);
		const at = (x: number) => Math.min(columns - 1, Math.max(0, Math.floor(x / LANDING_STEP)));

		for (const rect of rects) {
			for (let col = at(rect.x); col <= at(rect.x + rect.w); col++) this.landings[col].push(rect.y);
		}
		for (const line of lines) {
			for (let i = 1; i < line.length; i++) {
				const [a, b] = line[i - 1].x <= line[i].x ? [line[i - 1], line[i]] : [line[i], line[i - 1]];
				for (let col = at(a.x); col <= at(b.x); col++) {
					const x = col * LANDING_STEP;
					const t = b.x - a.x > 0 ? Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x))) : 0;
					this.landings[col].push(a.y + (b.y - a.y) * t);
				}
			}
		}
	}

	/** The first surface a drop meets falling from `fromY` to `toY` at `x`, or null. */
	landingBetween(x: number, fromY: number, toY: number): number | null {
		const column = this.landings[Math.floor(x / LANDING_STEP)];
		if (!column) return null;
		let first: number | null = null;
		for (const y of column) if (y > fromY && y <= toY && (first === null || y < first)) first = y;
		return first;
	}

	/** Pixels to the nearest sheet; 0 inside it. Far away (or before the first update) is a large number. */
	distanceAt(x: number, y: number): number {
		if (this.cols === 0) return FAR;
		const col = Math.min(this.cols - 1, Math.max(0, Math.round(x / CELL)));
		const row = Math.min(this.rows - 1, Math.max(0, Math.round(y / CELL)));
		return Math.min(FAR, this.distance[row * this.cols + col] * CELL);
	}

	/** The direction away from the nearest sheet, as a unit vector (0, 0 when nothing is near). */
	awayFrom(x: number, y: number): { x: number; y: number } {
		const gx = this.distanceAt(x + CELL, y) - this.distanceAt(x - CELL, y);
		const gy = this.distanceAt(x, y + CELL) - this.distanceAt(x, y - CELL);
		const length = Math.hypot(gx, gy);
		return length > 0 ? { x: gx / length, y: gy / length } : { x: 0, y: 0 };
	}

	/** Wipes anything drawn over sheets, which have their own background, and fades it under text. */
	clear(context: CanvasRenderingContext2D) {
		if (this.rects.length === 0 && this.halos.length === 0) return;
		context.save();
		context.globalAlpha = 1;
		context.globalCompositeOperation = "destination-out";
		context.beginPath();
		for (const rect of this.rects) context.rect(rect.x, rect.y, rect.w, rect.h);
		context.fill();
		for (const ring of HALO_RINGS) {
			context.globalAlpha = ring.fade;
			context.beginPath();
			for (const { x, y, w, h } of this.halos) {
				const p = ring.padding;
				context.roundRect(x - p, y - p, w + p * 2, h + p * 2, p + 2);
			}
			context.fill();
		}
		context.restore();
	}
}
