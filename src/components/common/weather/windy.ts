import { buildPath, makeLines, tracePath, type FieldLine } from "@/components/common/ledger-field";
import { STROKES, noise, type Scene } from "./scene";

const DEBRIS = ["~", ",", "'", "·", "`", "-"];

interface Debris {
	x: number;
	y: number;
	speed: number;
	phase: number;
	spin: boolean;
	char: string;
}

/**
 * A chaotic day: the app's own Wind lines, exactly as on a normal day, with bits of debris blown
 * across the page in gusts.
 */
export function createWindyScene(): Scene {
	let lines: FieldLine[] = [];
	let debris: Debris[] = [];

	return {
		resize(width, height) {
			const fresh = makeLines(height);
			if (fresh.length !== lines.length) lines = fresh;
			debris = Array.from({ length: Math.round((width * height) / 26000) }, () => ({
				x: Math.random() * width,
				y: Math.random() * height,
				speed: 260 + Math.random() * 260,
				phase: Math.random() * Math.PI * 2,
				spin: Math.random() < 0.5,
				char: DEBRIS[Math.floor(Math.random() * DEBRIS.length)],
			}));
		},
		draw(frame) {
			const { context, width, height, time, delta, pointer, palette, glyphs, obstacles } = frame;
			const gust = 0.85 + 0.6 * noise(time * 0.5, 3.1);
			const strength = palette.strength * frame.fade;

			context.globalAlpha = 1;
			context.lineCap = "round";
			context.lineJoin = "round";
			for (const line of lines) {
				const { points, length } = buildPath(line, width, height, pointer, time * 1000);
				const path = tracePath(points);
				const tone = line.tint === "ink" ? palette.ink : palette.tint;

				context.setLineDash([]);
				context.lineWidth = 1;
				context.strokeStyle = `rgba(${tone}, ${line.alpha * strength})`;
				context.stroke(path);

				const cycle = length + line.segment;
				line.progress = (line.progress + line.speed * delta) % cycle;
				const strokeStart = line.direction === 1 ? line.progress - line.segment : length - line.progress;
				context.setLineDash([line.segment, length + line.segment * 2]);
				context.lineDashOffset = -strokeStart;
				context.lineWidth = 5;
				context.strokeStyle = `rgba(${tone}, ${0.045 * strength})`;
				context.stroke(path);
				context.lineWidth = 1.1;
				context.strokeStyle = `rgba(${tone}, ${(line.tint === "ink" ? 0.42 : 0.26) * strength})`;
				context.stroke(path);
			}
			context.setLineDash([]);
			context.lineDashOffset = 0;

			for (const piece of debris) {
				piece.x += piece.speed * gust * delta;
				piece.y += Math.sin(time * 3 + piece.phase) * 40 * delta;
				if (obstacles.distanceAt(piece.x, piece.y) < 24)
					piece.y += obstacles.awayFrom(piece.x, piece.y).y * 160 * delta;
				if (piece.x > width + 20) {
					piece.x = -20;
					piece.y = Math.random() * height;
				}
				const char = piece.spin ? STROKES[Math.floor(time * 8 + piece.phase) % 4] : piece.char;
				glyphs.put("ink", char, piece.x, piece.y, 0.4);
			}
		},
	};
}
