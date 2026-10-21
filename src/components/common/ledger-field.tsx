"use client";

import { useEffect, useRef } from "react";

type FieldLine = {
	base: number;
	amp: number;
	freq: number;
	phase: number;
	slope: number;
	speed: number;
	segment: number;
	progress: number;
	direction: 1 | -1;
	alpha: number;
	tint: "ink" | "rust";
};

type Pointer = { x: number; y: number } | null;

// Defaults match the paper login. A page can recolor the field by setting `--ledger-ink` and
// `--ledger-tint` (RGB triplets, e.g. "44, 40, 34") and scale every line with `--ledger-strength`.
const INK = "44, 40, 34";
const RUST = "145, 72, 44";

type Palette = { ink: string; tint: string; strength: number };

function readPalette(element: Element): Palette {
	const style = getComputedStyle(element);
	const strength = Number.parseFloat(style.getPropertyValue("--ledger-strength"));
	return {
		ink: style.getPropertyValue("--ledger-ink").trim() || INK,
		tint: style.getPropertyValue("--ledger-tint").trim() || RUST,
		strength: Number.isFinite(strength) ? strength : 1,
	};
}

function createRandom(seed: number) {
	let value = seed >>> 0;
	return () => {
		value = (value * 1664525 + 1013904223) >>> 0;
		return value / 4294967296;
	};
}

function makeLines(height: number): FieldLine[] {
	const random = createRandom(20260214);
	const count = Math.max(12, Math.min(26, Math.round(height / 54)));

	return Array.from({ length: count }, (_, index) => ({
		base: (index + 0.5) / count,
		amp: 6 + random() * 22,
		freq: 0.0018 + random() * 0.0035,
		phase: random() * Math.PI * 2,
		slope: (random() - 0.5) * 26,
		speed: 22 + random() * 54,
		segment: 70 + random() * 150,
		progress: random() * 900,
		direction: random() > 0.35 ? 1 : -1,
		alpha: 0.06 + random() * 0.05,
		tint: random() > 0.9 ? "rust" : "ink",
	}));
}

function buildPath(line: FieldLine, width: number, height: number, pointer: Pointer, time: number) {
	const points: Array<[number, number]> = [];
	const step = width > 900 ? 14 : 18;
	let length = 0;
	let previousX = 0;
	let previousY = 0;

	for (let x = -40; x <= width + 40; x += step) {
		let y = line.base * height;
		y += Math.sin(x * line.freq + line.phase + time * 0.000045) * line.amp;
		y += Math.sin(x * line.freq * 2.31 + line.phase * 1.7 + time * 0.00003) * line.amp * 0.32;
		y += (x / Math.max(width, 1) - 0.5) * line.slope;

		if (pointer) {
			const dx = x - pointer.x;
			const dy = y - pointer.y;
			const falloff = Math.exp(-(dx * dx + dy * dy) / (2 * 240 * 240));
			y += (pointer.y - y) * falloff * 0.14;
		}

		if (points.length > 0) {
			length += Math.hypot(x - previousX, y - previousY);
		}

		points.push([x, y]);
		previousX = x;
		previousY = y;
	}

	return { points, length };
}

function tracePath(points: Array<[number, number]>) {
	const path = new Path2D();
	path.moveTo(points[0][0], points[0][1]);
	for (let index = 1; index < points.length; index++) {
		path.lineTo(points[index][0], points[index][1]);
	}
	return path;
}

/**
 * Slow plotter lines drifting across the page, pulled gently toward the pointer.
 * Pauses while the tab is hidden and draws one still frame when reduced motion is on.
 */
export function LedgerField({ className = "" }: { className?: string }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const context = canvas.getContext("2d");
		if (!context) return;

		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
		const finePointer = window.matchMedia("(pointer: fine)");

		let width = 0;
		let height = 0;
		let lines: FieldLine[] = [];
		let pointer: Pointer = null;
		let frame = 0;
		let last = 0;
		let start = 0;
		let running = true;
		let palette = readPalette(canvas);

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			width = Math.max(1, rect.width);
			height = Math.max(1, rect.height);

			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			context.setTransform(dpr, 0, 0, dpr, 0, 0);

			lines = makeLines(height);
		};

		const drawLines = (time: number, delta: number) => {
			context.clearRect(0, 0, width, height);
			context.lineCap = "round";
			context.lineJoin = "round";

			const fade = start === 0 ? 0 : Math.min(1, (time - start) / 1300);

			for (const line of lines) {
				const { points, length } = buildPath(line, width, height, pointer, time);
				const path = tracePath(points);
				const tint = line.tint === "ink" ? palette.ink : palette.tint;
				const strength = palette.strength;

				context.setLineDash([]);
				context.lineWidth = 1;
				context.strokeStyle = `rgba(${tint}, ${line.alpha * fade * strength})`;
				context.stroke(path);

				if (reduceMotion.matches) continue;

				const cycle = length + line.segment;
				line.progress = (line.progress + line.speed * delta) % cycle;
				const offset = line.direction === 1 ? -line.progress : cycle - line.progress;

				context.setLineDash([line.segment, length + line.segment]);
				context.lineDashOffset = offset;

				context.lineWidth = 5;
				context.strokeStyle = `rgba(${tint}, ${0.045 * fade * strength})`;
				context.stroke(path);

				context.lineWidth = 1.1;
				context.strokeStyle = `rgba(${tint}, ${(line.tint === "ink" ? 0.42 : 0.26) * fade * strength})`;
				context.stroke(path);
			}

			context.setLineDash([]);
			context.lineDashOffset = 0;
		};

		const drawStatic = () => {
			context.clearRect(0, 0, width, height);
			context.lineCap = "round";
			context.lineJoin = "round";

			for (const line of lines) {
				const { points, length } = buildPath(line, width, height, null, 0);
				const path = tracePath(points);
				const tint = line.tint === "ink" ? palette.ink : palette.tint;
				const strength = palette.strength;

				context.setLineDash([]);
				context.lineWidth = 1;
				context.strokeStyle = `rgba(${tint}, ${line.alpha * 1.6 * strength})`;
				context.stroke(path);

				context.setLineDash([line.segment, length + line.segment]);
				context.lineDashOffset = -length * 0.42;
				context.lineWidth = 1.1;
				context.strokeStyle = `rgba(${tint}, ${(line.tint === "ink" ? 0.4 : 0.26) * strength})`;
				context.stroke(path);
			}

			context.setLineDash([]);
			context.lineDashOffset = 0;
		};

		const tick = (now: number) => {
			if (!running) return;

			if (last === 0) last = now;
			if (start === 0) start = now;

			const delta = Math.min(0.05, (now - last) / 1000);
			last = now;

			drawLines(now, delta);
			frame = requestAnimationFrame(tick);
		};

		const restart = () => {
			cancelAnimationFrame(frame);
			if (reduceMotion.matches) {
				drawStatic();
				return;
			}
			last = 0;
			start = 0;
			running = true;
			frame = requestAnimationFrame(tick);
		};

		const handlePointerMove = (event: PointerEvent) => {
			if (!finePointer.matches) {
				pointer = null;
				return;
			}

			const rect = canvas.getBoundingClientRect();
			const x = event.clientX - rect.left;
			const y = event.clientY - rect.top;
			pointer = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height ? { x, y } : null;
		};

		const handlePointerLeave = () => {
			pointer = null;
		};

		const handleVisibility = () => {
			if (document.hidden) {
				running = false;
				cancelAnimationFrame(frame);
				return;
			}
			if (!reduceMotion.matches) {
				restart();
			}
		};

		const handleMotionChange = () => {
			restart();
		};

		const observer = new ResizeObserver(() => {
			resize();
			if (reduceMotion.matches) drawStatic();
		});

		// Pick up light/dark theme switches, which change the CSS colors.
		const themeObserver = new MutationObserver(() => {
			palette = readPalette(canvas);
			if (reduceMotion.matches) drawStatic();
		});
		themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

		resize();
		observer.observe(canvas.parentElement ?? canvas);

		window.addEventListener("pointermove", handlePointerMove, { passive: true });
		window.addEventListener("pointerleave", handlePointerLeave);
		document.addEventListener("visibilitychange", handleVisibility);
		reduceMotion.addEventListener("change", handleMotionChange);

		if (reduceMotion.matches) {
			drawStatic();
		} else {
			frame = requestAnimationFrame(tick);
		}

		return () => {
			running = false;
			cancelAnimationFrame(frame);
			observer.disconnect();
			themeObserver.disconnect();
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerleave", handlePointerLeave);
			document.removeEventListener("visibilitychange", handleVisibility);
			reduceMotion.removeEventListener("change", handleMotionChange);
		};
	}, []);

	return <canvas ref={canvasRef} aria-hidden className={className} />;
}
