/**
 * Where the page's content sits, so the weather can flow around it instead of across it.
 *
 * Cards, buttons, inputs, small graphics and every line of text are read from the layout, padded
 * a little, and drawn into a coarse grid. A distance field over that grid tells clouds and debris
 * how close the nearest content is and which way is clear. The tops of those boxes, and the lines
 * drawn in charts, are also kept as surfaces that rain lands and splashes on.
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
	/** Lines drawn in charts, as points in the canvas's coordinates. */
	lines: Point[][];
}

const ELEMENTS = [
	".surface-sheet",
	"button",
	"a[href]",
	"input",
	"select",
	"textarea",
	"svg",
	"img",
	"[role='progressbar']",
	".progress-line",
].join(",");

const CHART_SIZE = 120;
/** Pixels between samples along a chart line. */
const LINE_SAMPLE = 6;
/** Width of the columns rain checks for a surface to land on. */
const LANDING_STEP = 3;
const TEXT_PADDING = 6;
const ELEMENT_PADDING = 4;
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

/** Content in the canvas's coordinates: padded boxes (content inside a card is covered by the card) and chart lines. */
export function collectObstacles(root: Element, origin: DOMRect): Obstacles {
	const rects: Rect[] = [];
	const lines: Point[][] = [];
	const add = (rect: DOMRect, padding: number) => {
		if (rect.width < 1 || rect.height < 1) return;
		if (rect.bottom < origin.top || rect.top > origin.bottom || rect.right < origin.left || rect.left > origin.right)
			return;
		rects.push({
			x: rect.left - origin.left - padding,
			y: rect.top - origin.top - padding,
			w: rect.width + padding * 2,
			h: rect.height + padding * 2,
		});
	};

	root.querySelectorAll(ELEMENTS).forEach((element) => {
		if (inside(element, ".surface-sheet")) return;
		const rect = element.getBoundingClientRect();
		// A chart is mostly empty space around a thin line: only the line itself is a surface.
		if (element.tagName.toLowerCase() === "svg" && rect.width > CHART_SIZE && rect.height > CHART_SIZE) {
			lines.push(...chartLines(element as SVGSVGElement, origin));
			return;
		}
		add(rect, ELEMENT_PADDING);
	});

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (!node.textContent?.trim()) continue;
		const parent = node.parentElement;
		if (!parent || parent.closest(".surface-sheet") || parent.closest(ELEMENTS)) continue;
		range.selectNodeContents(node);
		for (const rect of Array.from(range.getClientRects())) add(rect, TEXT_PADDING);
	}
	return { rects, lines };
}

export class ObstacleField {
	rects: Rect[] = [];
	private cols = 0;
	private rows = 0;
	private distance = new Float32Array(0);
	/** For each narrow column of the page, the heights of the surfaces in it. */
	private landings: number[][] = [];

	update({ rects, lines }: Obstacles, width: number, height: number) {
		this.rects = rects;
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

	/** Pixels to the nearest content; 0 inside it. Far away (or before the first update) is a large number. */
	distanceAt(x: number, y: number): number {
		if (this.cols === 0) return FAR;
		const col = Math.min(this.cols - 1, Math.max(0, Math.round(x / CELL)));
		const row = Math.min(this.rows - 1, Math.max(0, Math.round(y / CELL)));
		return Math.min(FAR, this.distance[row * this.cols + col] * CELL);
	}

	/** The direction away from the nearest content, as a unit vector (0, 0 when nothing is near). */
	awayFrom(x: number, y: number): { x: number; y: number } {
		const gx = this.distanceAt(x + CELL, y) - this.distanceAt(x - CELL, y);
		const gy = this.distanceAt(x, y + CELL) - this.distanceAt(x, y - CELL);
		const length = Math.hypot(gx, gy);
		return length > 0 ? { x: gx / length, y: gy / length } : { x: 0, y: 0 };
	}

	/** Wipes anything drawn over content, so the weather never sits on top of words. */
	clear(context: CanvasRenderingContext2D) {
		if (this.rects.length === 0) return;
		context.save();
		context.globalAlpha = 1;
		context.globalCompositeOperation = "destination-out";
		context.beginPath();
		for (const rect of this.rects) context.rect(rect.x, rect.y, rect.w, rect.h);
		context.fill();
		context.restore();
	}
}
