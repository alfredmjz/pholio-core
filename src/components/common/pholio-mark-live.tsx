"use client";

import { useEffect, useRef } from "react";
import { STATIC_POSE, logoChar, renderLogoGrid, type LogoPose } from "@/lib/ascii-logo";

const CELL_SIZE = 6;
const FRAME_INTERVAL = 70;

interface PholioMarkLiveProps {
	size?: number;
	className?: string;
}

/** The 3D p drawn in shading characters, swaying slowly. Holds still when reduced motion is on. */
export function PholioMarkLive({ size = 120, className }: PholioMarkLiveProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context) return;

		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
		const cells = Math.round(size / CELL_SIZE);
		const cellSize = size / cells;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(size * dpr);
		canvas.height = Math.round(size * dpr);
		context.setTransform(dpr, 0, 0, dpr, 0, 0);

		const style = getComputedStyle(canvas);
		const ink = style.color;
		const accent = `hsl(${style.getPropertyValue("--accent").trim()})`;

		let frame = 0;
		let last = 0;

		const draw = (pose: LogoPose) => {
			const { filled, light, accent: rim } = renderLogoGrid(cells, pose);
			context.clearRect(0, 0, size, size);
			context.font = `700 ${(cellSize * 1.35).toFixed(1)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
			context.textAlign = "center";
			context.textBaseline = "middle";

			for (let cell = 0; cell < filled.length; cell++) {
				if (!filled[cell]) continue;
				const col = cell % cells;
				const row = Math.floor(cell / cells);
				context.fillStyle = rim[cell] ? accent : ink;
				context.fillText(logoChar(light[cell]), (col + 0.5) * cellSize, (row + 0.5) * cellSize);
			}
		};

		const tick = (now: number) => {
			if (now - last >= FRAME_INTERVAL) {
				last = now;
				draw({ yaw: -0.15 + 0.45 * Math.sin(now / 1700), pitch: 0.3 + 0.1 * Math.sin(now / 2400) });
			}
			frame = requestAnimationFrame(tick);
		};

		const restart = () => {
			cancelAnimationFrame(frame);
			if (reduceMotion.matches || document.hidden) {
				draw(STATIC_POSE);
				return;
			}
			last = 0;
			frame = requestAnimationFrame(tick);
		};

		restart();
		document.addEventListener("visibilitychange", restart);
		reduceMotion.addEventListener("change", restart);

		return () => {
			cancelAnimationFrame(frame);
			document.removeEventListener("visibilitychange", restart);
			reduceMotion.removeEventListener("change", restart);
		};
	}, [size]);

	return <canvas ref={canvasRef} aria-hidden className={className} style={{ width: size, height: size }} />;
}
