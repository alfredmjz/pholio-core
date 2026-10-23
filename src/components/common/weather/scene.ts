import type { Palette, Pointer } from "@/components/common/ledger-field";
import type { ObstacleField } from "./obstacles";

export const CELL_W = 7;
export const CELL_H = 11;
const FONT_PX = 10.5;
const MONO = 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace';
const CHARSET = Array.from(" .,'`-=~^+*|/\\·V");
// Small type reads lighter than a line, so glyph alphas are lifted to match the wind lines.
const CONTRAST = 1.75;

export interface SceneFrame {
	context: CanvasRenderingContext2D;
	width: number;
	height: number;
	/** Seconds of animation so far; fixed for the reduced-motion still frame. */
	time: number;
	/** Seconds since the last frame; 0 for a still frame. */
	delta: number;
	pointer: Pointer;
	/** The pointer's recent velocity in px/s, eased, for clouds to drift with. */
	wind: { x: number; y: number };
	palette: Palette;
	glyphs: Glyphs;
	/** The page's content, for the weather to flow around. */
	obstacles: ObstacleField;
	/** 0 to 1 while the scene first fades in. */
	fade: number;
}

export interface Scene {
	resize(width: number, height: number): void;
	draw(frame: SceneFrame): void;
}

/** Pre-drawn monospace characters in the ink and green tones, stamped onto the scene. */
export class Glyphs {
	private atlases: Record<"ink" | "tint", HTMLCanvasElement>;
	private cellW = 0;
	private cellH = 0;
	private index = new Map(CHARSET.map((char, i) => [char, i]));
	private context: CanvasRenderingContext2D | null = null;
	/** Scales every glyph, from `--weather-strength` and the fade-in. */
	alpha = 1;

	constructor(palette: Palette, dpr: number) {
		this.cellW = Math.ceil(CELL_W * dpr);
		this.cellH = Math.ceil(CELL_H * dpr);
		this.atlases = { ink: this.build(palette.ink, dpr), tint: this.build(palette.tint, dpr) };
	}

	private build(rgb: string, dpr: number): HTMLCanvasElement {
		const atlas = document.createElement("canvas");
		atlas.width = this.cellW * CHARSET.length;
		atlas.height = this.cellH;
		const context = atlas.getContext("2d");
		if (!context) return atlas;
		context.font = `600 ${FONT_PX * dpr}px ${MONO}`;
		context.textAlign = "center";
		context.textBaseline = "middle";
		context.fillStyle = `rgb(${rgb})`;
		CHARSET.forEach((char, i) => context.fillText(char, i * this.cellW + this.cellW / 2, this.cellH / 2 + dpr * 0.5));
		return atlas;
	}

	bind(context: CanvasRenderingContext2D) {
		this.context = context;
	}

	put(tone: "ink" | "tint", char: string, x: number, y: number, alpha: number) {
		const i = this.index.get(char);
		const value = alpha * CONTRAST * this.alpha;
		if (!this.context || i === undefined || i === 0 || value <= 0.01) return;
		this.context.globalAlpha = Math.min(1, value);
		this.context.drawImage(this.atlases[tone], i * this.cellW, 0, this.cellW, this.cellH, x, y, CELL_W, CELL_H);
	}
}

export function hash(x: number, y: number): number {
	let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
	return t * t * (3 - 2 * t);
}

/** Smooth value noise in roughly 0..1. */
export function noise(x: number, y: number): number {
	const xi = Math.floor(x);
	const yi = Math.floor(y);
	const xf = smooth(x - xi);
	const yf = smooth(y - yi);
	const a = hash(xi, yi);
	const b = hash(xi + 1, yi);
	const c = hash(xi, yi + 1);
	const d = hash(xi + 1, yi + 1);
	return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

/** 1 at the pointer, falling to 0 at `radius`, eased. */
export function nearPointer(frame: SceneFrame, x: number, y: number, radius: number): number {
	if (!frame.pointer) return 0;
	const distance = Math.hypot(x - frame.pointer.x, y - frame.pointer.y);
	if (distance >= radius) return 0;
	const falloff = 1 - distance / radius;
	return falloff * falloff;
}

export const STROKES = ["-", "\\", "|", "/"];
