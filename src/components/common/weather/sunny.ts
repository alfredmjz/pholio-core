import { drawBirds, drawClouds, makeClouds } from "./clouds";
import { CELL_H, CELL_W, STROKES, hash, noise, type Scene } from "./scene";

const SUN_RAMP = ["·", "-", "=", "+", "*"];

/**
 * A good day: a sun in the top right with slowly turning rays, light clouds, glints across the
 * page and the birds. The sun leans a little toward the pointer, and the rays facing it stretch.
 */
export function createSunnyScene(): Scene {
	const far = makeClouds(502, { count: 3, size: 0.6, yFrom: 0.05, yTo: 0.3 });
	const near = makeClouds(501, { count: 4, size: 0.75, yFrom: 0.35, yTo: 0.85 });
	let glints: { x: number; y: number; phase: number; rate: number }[] = [];
	const lean = { x: 0, y: 0, turn: 0, presence: 0, toward: 0 };

	return {
		resize(width, height) {
			glints = Array.from({ length: Math.round((width * height) / 9000) }, () => ({
				x: Math.random() * width,
				y: Math.random() * height,
				phase: Math.random() * Math.PI * 2,
				rate: 0.4 + Math.random() * 0.9,
			}));
		},
		draw(frame) {
			const { glyphs, width, height, time, pointer } = frame;
			const homeX = width * 0.8;
			const homeY = height * 0.2;

			let target = { x: 0, y: 0, turn: 0, presence: 0 };
			if (pointer) {
				const dx = pointer.x - homeX;
				const dy = pointer.y - homeY;
				const distance = Math.hypot(dx, dy) || 1;
				const nearness = Math.min(1, 260 / distance);
				target = {
					x: (dx / distance) * 14 * nearness,
					y: (dy / distance) * 14 * nearness,
					turn: (dx / width) * 0.35,
					presence: 0.35 + nearness * 0.65,
				};
				lean.toward = Math.atan2(dy, dx);
			}
			const ease = Math.min(1, frame.delta * 2.5);
			lean.x += (target.x - lean.x) * ease;
			lean.y += (target.y - lean.y) * ease;
			lean.turn += (target.turn - lean.turn) * ease;
			lean.presence += (target.presence - lean.presence) * ease;

			const sunX = homeX + lean.x;
			const sunY = homeY + lean.y;
			const radius = Math.max(26, Math.min(width, height) * 0.07) * (1 + 0.03 * Math.sin(time * 1.2));

			for (let k = 0; k < 16; k++) {
				const angle = (k * Math.PI * 2) / 16 + time * 0.05 + lean.turn;
				const facing = lean.presence * Math.max(0, Math.cos(angle - lean.toward)) ** 3;
				const from = radius * 1.45;
				const to = radius * (k % 2 === 0 ? 3.1 : 2.3) * (1 + 0.35 * facing);
				const folded = ((angle % Math.PI) + Math.PI) % Math.PI;
				const char = STROKES[Math.round(folded / (Math.PI / 4)) % 4];
				for (let r = from; r < to; r += CELL_W * 1.4) {
					const fade = 1 - (r - from) / (to - from);
					glyphs.put(
						"ink",
						char,
						sunX + Math.cos(angle) * r - CELL_W / 2,
						sunY + Math.sin(angle) * r - CELL_H / 2,
						0.12 + 0.35 * fade + 0.25 * facing
					);
				}
			}

			for (let y = sunY - radius * 1.3; y <= sunY + radius * 1.3; y += CELL_H) {
				for (let x = sunX - radius * 1.3; x <= sunX + radius * 1.3; x += CELL_W) {
					const distance = Math.hypot(x - sunX, (y - sunY) * 1.05) / radius;
					if (distance < 1) {
						const level = Math.min(
							0.999,
							Math.max(0, 1 - distance * distance + (noise(x * 0.05, y * 0.05 + time * 0.3) - 0.5) * 0.2)
						);
						glyphs.put(
							"tint",
							SUN_RAMP[Math.floor(level * SUN_RAMP.length)],
							x - CELL_W / 2,
							y - CELL_H / 2,
							0.25 + 0.4 * level
						);
					} else if (distance < 1.25 && hash(Math.round(x), Math.round(y)) < 0.5) {
						glyphs.put("ink", "·", x - CELL_W / 2, y - CELL_H / 2, 0.25);
					}
				}
			}

			for (const glint of glints) {
				const shine = Math.pow(Math.max(0, Math.sin(time * glint.rate + glint.phase)), 8);
				if (shine >= 0.05 && frame.obstacles.distanceAt(glint.x, glint.y) > 10)
					glyphs.put("ink", shine > 0.6 ? "+" : "·", glint.x, glint.y, shine * 0.45);
			}

			drawClouds(frame, far, { speed: 0.6, alpha: 0.3 });
			drawClouds(frame, near, { speed: 1.4, alpha: 0.42 });
			drawBirds(frame, 0.4);
		},
	};
}
