import { CELL_H, CELL_W, type Scene } from "./scene";

const SLANT = 0.2;
const GRAVITY = 700;
const SPLASH_SECONDS = 0.45;
const MAX_SPLASHES = 240;
/** The cursor shelters a small half-circle over the arrow, like an umbrella. */
const UMBRELLA_RADIUS = 18;
// Centred a little down and right of the tip, over the body of the arrow, so drops land just above it.
const UMBRELLA_OFFSET = { x: 4, y: 6 };

interface Drop {
	x: number;
	y: number;
	/** Nearness, 0.35..1: nearer drops fall faster and darker. */
	z: number;
}

interface Droplet {
	x: number;
	y: number;
	vx: number;
	vy: number;
	at: number;
	z: number;
}

/**
 * A bad day: light rain falling at a slant over the whole page. Drops land on the tops of cards
 * and text, on chart lines, on the cursor (an umbrella) and on the bottom edge, and splash: a few
 * droplets bounce up and fall back.
 */
export function createRainyScene(): Scene {
	let drops: Drop[] = [];
	let droplets: Droplet[] = [];
	let width = 0;
	let height = 0;

	const respawn = (drop: Drop, y: number) => {
		drop.x = Math.random() * (width + height * SLANT) - height * SLANT;
		drop.y = y;
	};

	const splash = (x: number, y: number, z: number, time: number, push: number) => {
		const count = z > 0.7 ? 3 : 2;
		for (let i = 0; i < count && droplets.length < MAX_SPLASHES; i++) {
			droplets.push({
				x,
				y: y - 1,
				vx: (Math.random() - 0.5) * 110 + push,
				vy: -(50 + Math.random() * 90) * z,
				at: time,
				z,
			});
		}
	};

	return {
		resize(nextWidth, nextHeight) {
			width = nextWidth;
			height = nextHeight;
			const count = Math.round((nextWidth * nextHeight) / 3600);
			if (drops.length === count) return;
			drops = Array.from({ length: count }, () => {
				const drop = { x: 0, y: 0, z: 0.35 + Math.random() * 0.65 };
				respawn(drop, Math.random() * nextHeight);
				return drop;
			});
		},
		draw(frame) {
			const { glyphs, delta, pointer, time, obstacles } = frame;

			for (const drop of drops) {
				const speed = 220 + 160 * drop.z;
				const x = drop.x + speed * SLANT * delta;
				const y = drop.y + speed * delta;

				let landed: number | null = obstacles.landingBetween(x, drop.y, y);
				let push = 0;
				const umbrellaX = pointer ? pointer.x + UMBRELLA_OFFSET.x : 0;
				if (pointer && Math.abs(x - umbrellaX) < UMBRELLA_RADIUS) {
					const dx = x - umbrellaX;
					const top = pointer.y + UMBRELLA_OFFSET.y - Math.sqrt(UMBRELLA_RADIUS * UMBRELLA_RADIUS - dx * dx);
					if (top > drop.y && top <= y && (landed === null || top < landed)) {
						landed = top;
						// Off the umbrella, droplets run outward and down its curve.
						push = (dx / UMBRELLA_RADIUS) * 120;
					}
				}
				if (landed === null && y >= height) landed = height - 2;

				if (landed !== null) {
					splash(x, landed, drop.z, time, push);
					respawn(drop, -Math.random() * height * 0.25);
					continue;
				}
				drop.x = x;
				drop.y = y;

				const char = drop.z > 0.7 ? "\\" : drop.z > 0.5 ? "'" : ".";
				const alpha = 0.14 + 0.3 * drop.z;
				glyphs.put("ink", char, drop.x - CELL_W / 2, drop.y - CELL_H / 2, alpha);
				if (drop.z > 0.8) {
					glyphs.put("ink", "\\", drop.x - CELL_W / 2 - SLANT * CELL_H, drop.y - CELL_H * 1.5, alpha * 0.4);
				}
			}

			droplets = droplets.filter((droplet) => time - droplet.at < SPLASH_SECONDS);
			for (const droplet of droplets) {
				droplet.vy += GRAVITY * delta;
				droplet.x += droplet.vx * delta;
				droplet.y += droplet.vy * delta;
				const fade = 1 - (time - droplet.at) / SPLASH_SECONDS;
				glyphs.put("ink", ".", droplet.x - CELL_W / 2, droplet.y - CELL_H / 2, (0.18 + 0.3 * droplet.z) * fade);
			}
		},
	};
}
