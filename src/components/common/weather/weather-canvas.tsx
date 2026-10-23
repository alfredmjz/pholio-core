"use client";

import { useEffect, useRef } from "react";
import { readPalette, type Pointer } from "@/components/common/ledger-field";
import type { Weather } from "@/lib/financial-weather";
import { createCloudyScene } from "./cloudy";
import { ObstacleField, collectObstacles } from "./obstacles";
import { createRainyScene } from "./rainy";
import { Glyphs, type Scene } from "./scene";
import { createSunnyScene } from "./sunny";
import { createWindyScene } from "./windy";

const CREATE: Record<Weather, () => Scene> = {
	cloudy: createCloudyScene,
	rainy: createRainyScene,
	sunny: createSunnyScene,
	windy: createWindyScene,
};

// Slow clouds look the same at 30 frames a second; falling rain and gusts need every frame.
const FRAME_SECONDS: Record<Weather, number> = { cloudy: 1 / 32, sunny: 1 / 32, rainy: 0, windy: 0 };
const FADE_IN_SECONDS = 1.3;
const STILL_TIME = 8;
/** Layout changes that fire no event (an animation, a late font) are picked up this often. */
const OBSTACLE_REFRESH_MS = 1000;

/**
 * Kept across mounts, so moving between pages continues the weather instead of restarting it
 * (and the fade-in plays once per visit, not on every page).
 */
const memory = new Map<Weather, { scene: Scene; time: number; shown: boolean }>();

function readStrength(element: Element): number {
	const value = Number.parseFloat(getComputedStyle(element).getPropertyValue("--weather-strength"));
	return Number.isFinite(value) ? value : 1;
}

/** One weather scene on a canvas. Pauses while the tab is hidden; one still frame for reduced motion. */
export function WeatherCanvas({ weather, className = "" }: { weather: Weather; className?: string }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const context = canvas.getContext("2d");
		if (!context) return;

		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
		const finePointer = window.matchMedia("(pointer: fine)");

		const state = memory.get(weather) ?? { scene: CREATE[weather](), time: 0, shown: false };
		memory.set(weather, state);

		let width = 0;
		let height = 0;
		let dpr = 1;
		let palette = readPalette(canvas);
		let strength = readStrength(canvas);
		let glyphs = new Glyphs(palette, dpr);
		let pointer: Pointer = null;
		let lastMove = { x: 0, y: 0, at: 0 };
		const velocity = { x: 0, y: 0 };
		const wind = { x: 0, y: 0 };
		let frame = 0;
		let last = 0;
		let pending = 0;
		let shownFor = state.shown ? FADE_IN_SECONDS : 0;
		let running = true;
		const obstacles = new ObstacleField();
		const content = canvas.closest(".surface")?.querySelector(".surface-content") ?? null;
		let obstaclesStale = true;
		let stillFrame = 0;

		const draw = (delta: number, still: boolean) => {
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
			context.clearRect(0, 0, width, height);
			if (obstaclesStale && content) {
				obstacles.update(collectObstacles(content, canvas.getBoundingClientRect()), width, height);
				obstaclesStale = false;
			}
			const fade = still ? 1 : Math.min(1, shownFor / FADE_IN_SECONDS);
			if (fade >= 1) state.shown = true;
			glyphs.alpha = strength * fade;
			glyphs.bind(context);

			velocity.x *= Math.exp(-delta * 4);
			velocity.y *= Math.exp(-delta * 4);
			const ease = Math.min(1, delta * 2.5);
			wind.x += (velocity.x - wind.x) * ease;
			wind.y += (velocity.y - wind.y) * ease;

			state.scene.draw({
				context,
				width,
				height,
				time: still ? STILL_TIME : state.time,
				delta,
				pointer: still ? null : pointer,
				wind,
				palette,
				glyphs,
				obstacles,
				fade,
			});
			obstacles.clear(context);
			context.globalAlpha = 1;
		};

		const drawStill = () => draw(0, true);

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			width = Math.max(1, rect.width);
			height = Math.max(1, rect.height);
			const nextDpr = Math.min(window.devicePixelRatio || 1, 1.5);
			canvas.width = Math.round(width * nextDpr);
			canvas.height = Math.round(height * nextDpr);
			if (nextDpr !== dpr) {
				dpr = nextDpr;
				glyphs = new Glyphs(palette, dpr);
			}
			state.scene.resize(width, height);
			obstaclesStale = true;
		};

		// Content moves when the page scrolls, resizes or changes; a still frame is redrawn to match.
		const markObstaclesStale = () => {
			obstaclesStale = true;
			if (!reduceMotion.matches) return;
			cancelAnimationFrame(stillFrame);
			stillFrame = requestAnimationFrame(drawStill);
		};
		const contentObserver = new MutationObserver(markObstaclesStale);
		const contentResize = new ResizeObserver(markObstaclesStale);
		if (content) {
			contentObserver.observe(content, { childList: true, subtree: true, characterData: true });
			contentResize.observe(content);
		}
		const refresh = window.setInterval(markObstaclesStale, OBSTACLE_REFRESH_MS);

		const tick = (now: number) => {
			if (!running) return;
			if (last === 0) last = now;
			const elapsed = Math.min(0.1, (now - last) / 1000);
			last = now;
			pending += elapsed;
			if (pending >= FRAME_SECONDS[weather]) {
				const delta = Math.min(0.05, pending);
				state.time += delta;
				shownFor += delta;
				pending = 0;
				draw(delta, false);
			}
			frame = requestAnimationFrame(tick);
		};

		const restart = () => {
			cancelAnimationFrame(frame);
			if (reduceMotion.matches) {
				drawStill();
				return;
			}
			last = 0;
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
			const inside = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
			if (inside && pointer && lastMove.at > 0) {
				const seconds = Math.max(0.008, (event.timeStamp - lastMove.at) / 1000);
				velocity.x += ((x - lastMove.x) / seconds - velocity.x) * 0.3;
				velocity.y += ((y - lastMove.y) / seconds - velocity.y) * 0.3;
			}
			lastMove = { x, y, at: event.timeStamp };
			pointer = inside ? { x, y } : null;
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
			restart();
		};

		const observer = new ResizeObserver(() => {
			resize();
			if (reduceMotion.matches) drawStill();
		});

		// Pick up light/dark theme switches, which change the CSS colors.
		const themeObserver = new MutationObserver(() => {
			palette = readPalette(canvas);
			strength = readStrength(canvas);
			glyphs = new Glyphs(palette, dpr);
			if (reduceMotion.matches) drawStill();
		});
		themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

		resize();
		observer.observe(canvas.parentElement ?? canvas);
		window.addEventListener("pointermove", handlePointerMove, { passive: true });
		window.addEventListener("pointerleave", handlePointerLeave);
		window.addEventListener("scroll", markObstaclesStale, { capture: true, passive: true });
		document.addEventListener("visibilitychange", handleVisibility);
		reduceMotion.addEventListener("change", restart);
		restart();

		return () => {
			running = false;
			cancelAnimationFrame(frame);
			observer.disconnect();
			themeObserver.disconnect();
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerleave", handlePointerLeave);
			window.removeEventListener("scroll", markObstaclesStale, { capture: true });
			contentObserver.disconnect();
			contentResize.disconnect();
			window.clearInterval(refresh);
			cancelAnimationFrame(stillFrame);
			document.removeEventListener("visibilitychange", handleVisibility);
			reduceMotion.removeEventListener("change", restart);
		};
	}, [weather]);

	return <canvas ref={canvasRef} aria-hidden className={className} />;
}
