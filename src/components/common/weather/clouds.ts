import { createRandom } from "@/components/common/ledger-field";
import { CELL_H, CELL_W, nearPointer, noise, type SceneFrame } from "./scene";

const RAMP = [".", "-", "-", "=", "=", "~", "+"];
/** How close to a sheet, in pixels, a cloud starts to part around it. */
const FLOW_RADIUS = 36;

interface Puff {
	dx: number;
	dy: number;
	rx: number;
	ry: number;
}

export interface Cloud {
	/** Position along the drift, 0..1. */
	u: number;
	/** Height on screen, as a share of the page. */
	y: number;
	half: number;
	top: number;
	bottom: number;
	/** Rows below the centre where the flat base begins. */
	base: number;
	puffs: Puff[];
	seed: number;
}

/**
 * Cumulus clouds built from a few overlapping puffs: higher in the middle, a flat base, and edges
 * roughened by slowly changing noise, so each cloud keeps reshaping as it drifts. Sizes are in
 * character cells.
 */
export function makeClouds(
	seed: number,
	{ count, size, flat = 1, yFrom, yTo }: { count: number; size: number; flat?: number; yFrom: number; yTo: number }
): Cloud[] {
	const random = createRandom(seed);
	return Array.from({ length: count }, (_, index) => {
		const w = (16 + random() * 20) * size;
		const n = 3 + Math.floor(random() * 3);
		const puffs = Array.from({ length: n }, (_, i) => {
			const along = i / (n - 1) - 0.5;
			const rx = w * (0.27 - Math.abs(along) * 0.16) * (0.85 + random() * 0.3);
			const ry = rx * 0.66 * flat;
			return { dx: along * w * 0.6 + (random() - 0.5) * 2, dy: -ry * (0.75 - Math.abs(along) * 0.9), rx, ry };
		});
		const base = Math.max(...puffs.map((puff) => puff.ry)) * 0.3;
		return {
			u: (index + random() * 0.8) / count,
			y: yFrom + random() * (yTo - yFrom),
			half: Math.ceil(w / 2) + 3,
			top: Math.floor(Math.min(...puffs.map((puff) => puff.dy - puff.ry))) - 1,
			bottom: Math.ceil(base) + 1,
			base,
			puffs,
			seed: random() * 100,
		};
	});
}

/** Draws a layer of clouds drifting left at `speed` columns per second. The pointer blows them along. */
export function drawClouds(frame: SceneFrame, clouds: Cloud[], { speed, alpha }: { speed: number; alpha: number }) {
	const cols = Math.ceil(frame.width / CELL_W);
	const rows = Math.ceil(frame.height / CELL_H);
	const period = cols + 90;

	for (const cloud of clouds) {
		const center = ((((cloud.u * period - frame.time * speed) % period) + period) % period) - 45;
		if (center + cloud.half < -2 || center - cloud.half > cols + 2) continue;
		const anchorRow = Math.round(cloud.y * rows);

		for (let j = cloud.top; j <= cloud.bottom; j++) {
			const row = anchorRow + j;
			if (row < 0 || row >= rows) continue;
			const y = row * CELL_H;
			for (let i = -cloud.half; i <= cloud.half; i++) {
				const x = (center + i) * CELL_W;
				if (x < -CELL_W || x > frame.width) continue;

				// Sample a little upwind of the cell, so the cloud looks blown along.
				let dx = i;
				let dy = j;
				const falloff = nearPointer(frame, x + CELL_W / 2, y + CELL_H / 2, 150);
				if (falloff > 0) {
					dx -= (frame.wind.x / CELL_W) * falloff * 0.18;
					dy -= (frame.wind.y / CELL_H) * falloff * 0.18;
				}

				// Near content the cloud is drawn as if pushed aside, and thins out.
				let thin = 1;
				const clearance = frame.obstacles.distanceAt(x + CELL_W / 2, y + CELL_H / 2);
				if (clearance < FLOW_RADIUS) {
					const away = frame.obstacles.awayFrom(x + CELL_W / 2, y + CELL_H / 2);
					const push = (1 - clearance / FLOW_RADIUS) ** 2 * 4;
					dx -= away.x * push;
					dy -= away.y * push * 0.6;
					thin = 0.4 + 0.6 * (clearance / FLOW_RADIUS);
				}

				let density = 0;
				for (const puff of cloud.puffs) {
					const ex = (dx - puff.dx) / puff.rx;
					const ey = (dy - puff.dy) / puff.ry;
					density = Math.max(density, 1 - ex * ex - ey * ey);
				}
				if (dy > cloud.base) density -= (dy - cloud.base) * 0.8;
				density += (noise(dx * 0.32 + cloud.seed, dy * 0.55 + frame.time * 0.12) - 0.5) * 0.28;
				if (density < 0.08) continue;

				const level = Math.min(0.999, density / 1.05);
				frame.glyphs.put("ink", RAMP[Math.floor(level * RAMP.length)], x, y, alpha * thin * (0.35 + 0.65 * level));
			}
		}
	}
}

/** A small flock crossing about every 26 seconds, at `heightShare` of the page. */
export function drawBirds(frame: SceneFrame, heightShare: number) {
	const cycle = 26;
	const phase = (frame.time % cycle) / cycle;
	if (phase >= 0.6) return;
	const progress = phase / 0.6;
	const flockX = frame.width * 1.05 - progress * (frame.width * 1.2);
	const flockY = frame.height * heightShare + Math.sin(progress * 6) * 12;
	const wing = Math.sin(frame.time * 10) > 0 ? "V" : "^";
	for (const [bx, by] of [
		[0, 0],
		[16, 8],
		[30, -6],
		[44, 12],
		[24, 20],
	]) {
		frame.glyphs.put("ink", wing, flockX + bx, flockY + by + Math.sin(frame.time * 3 + bx) * 3, 0.55);
	}
}
