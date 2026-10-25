export type LogoPose = { yaw: number; pitch: number };

export type LogoGrid = {
	size: number;
	filled: Uint8Array;
	light: Float32Array;
	accent: Uint8Array;
};

export type LogoGlyph =
	| { shape: "rect"; x: number; y: number; width: number; height: number; accent: boolean }
	| { shape: "circle"; x: number; y: number; r: number; accent: boolean };

export const LOGO_RAMP = ".,-~:;=!*#$@";
export const STATIC_POSE: LogoPose = { yaw: -0.45, pitch: 0.25 };

const BOWL_RADIUS = 8;
const TUBE_RADIUS = 3.3;
const BOWL_CENTER = { x: 5, y: -5 };
const STEM_X = -3;
const STEM_TOP = -13;
const STEM_BOTTOM = 17;
// Shifts the model so the p's bounding box is centred on the origin.
const OFFSET = { x: 5, y: 2 };
const CAMERA_DISTANCE = 60;
const FIELD_OF_VIEW = 46;
const LIGHT = { x: -0.45, y: -0.55, z: -0.7 };
// The accent traces the bowl's inner rim, the outline of the counter: tube points facing the hole.
const INNER_RIM = -0.35;
const STRIDE = 7;

let cloud: Float32Array | null = null;

// Surface points of a lowercase p as [x, y, z, nx, ny, nz, accent]: a torus bowl and a round-capped stem.
function buildCloud() {
	const points: number[] = [];
	const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number, accent = 0) =>
		points.push(x - OFFSET.x, y - OFFSET.y, z, nx, ny, nz, accent);

	for (let theta = 0; theta < Math.PI * 2; theta += 0.08) {
		const cosTheta = Math.cos(theta);
		const sinTheta = Math.sin(theta);

		for (let phi = 0; phi < Math.PI * 2; phi += 0.025) {
			const cosPhi = Math.cos(phi);
			const sinPhi = Math.sin(phi);
			const ring = BOWL_RADIUS + TUBE_RADIUS * cosTheta;
			push(
				BOWL_CENTER.x + ring * cosPhi,
				BOWL_CENTER.y + ring * sinPhi,
				TUBE_RADIUS * sinTheta,
				cosTheta * cosPhi,
				cosTheta * sinPhi,
				sinTheta,
				cosTheta < INNER_RIM ? 1 : 0
			);
		}

		for (let y = STEM_TOP; y <= STEM_BOTTOM; y += 0.18) {
			push(STEM_X + TUBE_RADIUS * cosTheta, y, TUBE_RADIUS * sinTheta, cosTheta, 0, sinTheta);
		}
	}

	for (const capY of [STEM_TOP, STEM_BOTTOM]) {
		for (let u = 0; u < Math.PI; u += 0.1) {
			for (let v = 0; v < Math.PI * 2; v += 0.1) {
				const nx = Math.sin(u) * Math.cos(v);
				const ny = Math.cos(u);
				const nz = Math.sin(u) * Math.sin(v);
				push(STEM_X + TUBE_RADIUS * nx, capY + TUBE_RADIUS * ny, TUBE_RADIUS * nz, nx, ny, nz);
			}
		}
	}

	return new Float32Array(points);
}

export function renderLogoGrid(size: number, { yaw, pitch }: LogoPose): LogoGrid {
	cloud ??= buildCloud();

	const filled = new Uint8Array(size * size);
	const light = new Float32Array(size * size);
	const accent = new Uint8Array(size * size);
	const depth = new Float32Array(size * size);
	const scale = (CAMERA_DISTANCE * size) / FIELD_OF_VIEW;
	const cosYaw = Math.cos(yaw);
	const sinYaw = Math.sin(yaw);
	const cosPitch = Math.cos(pitch);
	const sinPitch = Math.sin(pitch);

	for (let index = 0; index < cloud.length; index += STRIDE) {
		const x = cloud[index];
		const y = cloud[index + 1];
		const z = cloud[index + 2];

		const x1 = x * cosYaw + z * sinYaw;
		const z1 = -x * sinYaw + z * cosYaw;
		const y2 = y * cosPitch - z1 * sinPitch;
		const z2 = y * sinPitch + z1 * cosPitch;

		const inverseDepth = 1 / (z2 + CAMERA_DISTANCE);
		const col = Math.floor(size / 2 + scale * inverseDepth * x1);
		const row = Math.floor(size / 2 + scale * inverseDepth * y2);
		if (col < 0 || row < 0 || col >= size || row >= size) continue;

		const cell = row * size + col;
		if (inverseDepth <= depth[cell]) continue;

		const nx = cloud[index + 3];
		const ny = cloud[index + 4];
		const nz = cloud[index + 5];
		const nx1 = nx * cosYaw + nz * sinYaw;
		const nz1 = -nx * sinYaw + nz * cosYaw;
		const ny2 = ny * cosPitch - nz1 * sinPitch;
		const nz2 = ny * sinPitch + nz1 * cosPitch;

		depth[cell] = inverseDepth;
		filled[cell] = 1;
		light[cell] = nx1 * LIGHT.x + ny2 * LIGHT.y + nz2 * LIGHT.z;
		accent[cell] = cloud[index + 6];
	}

	return { size, filled, light, accent };
}

export function logoChar(light: number) {
	if (light <= 0) return ".";
	return LOGO_RAMP[Math.min(LOGO_RAMP.length - 1, Math.floor(light * LOGO_RAMP.length))];
}

// Characters per side for a still mark drawn at `size` pixels; bigger marks get roomier cells.
export function glyphGridSize(size: number) {
	const pitch = size <= 26 ? 2.2 : size <= 56 ? 3 : 4;
	return Math.round(size / pitch);
}

// One character as simple shapes centred in its 1-unit cell, so it stays crisp when tiny.
// `weight` thickens every stroke and dot, capped so a glyph never fills its cell.
export function glyphShapes(char: string, cx: number, cy: number, accent: boolean, weight = 1): LogoGlyph[] {
	const bar = (x: number, y: number, width: number, height: number): LogoGlyph => ({
		shape: "rect",
		x: cx + x,
		y: cy + y,
		width,
		height,
		accent,
	});
	const dot = (y: number, r: number): LogoGlyph => ({
		shape: "circle",
		x: cx,
		y: cy + y,
		r: Math.min(r * weight, 0.46),
		accent,
	});
	const stroke = (thickness: number) => Math.min(thickness * weight, 0.4);

	switch (char) {
		case ".":
		case ",":
			return [dot(0.15, 0.13)];
		case "-":
		case "~": {
			const h = stroke(0.16);
			return [bar(-0.32, -h / 2, 0.64, h)];
		}
		case ":":
		case ";":
			return [dot(-0.2, 0.12), dot(0.2, 0.12)];
		case "=": {
			const h = stroke(0.14);
			return [bar(-0.32, -0.08 - h, 0.64, h), bar(-0.32, 0.08, 0.64, h)];
		}
		case "!": {
			const h = stroke(0.16);
			return [bar(-h / 2, -0.38, h, 0.76)];
		}
		case "*": {
			const h = stroke(0.18);
			return [bar(-0.36, -h / 2, 0.72, h), bar(-h / 2, -0.36, h, 0.72)];
		}
		case "#": {
			const h = stroke(0.13);
			return [
				bar(-0.38, -0.155 - h / 2, 0.76, h),
				bar(-0.38, 0.155 - h / 2, 0.76, h),
				bar(-0.155 - h / 2, -0.38, h, 0.76),
				bar(0.155 - h / 2, -0.38, h, 0.76),
			];
		}
		default:
			return [dot(0, 0.4)];
	}
}

export type GlyphStyle = { weight: number; accent: "rim" | "scatter" };

// Small still icons need heavier strokes and green spread across the p to hold their shape.
export const ICON_STYLE: GlyphStyle = { weight: 1.7, accent: "scatter" };
// The email animation matches the live sign-in mark: regular strokes, green around the counter.
export const ANIMATION_STYLE: GlyphStyle = { weight: 1, accent: "rim" };
const SCATTER_SHARE = 0.28;

function cellHash(a: number, b: number) {
	let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}

const glyphCache = new Map<number, LogoGlyph[]>();

export function logoGlyphs(cells: number, pose: LogoPose = STATIC_POSE, style: GlyphStyle = ICON_STYLE): LogoGlyph[] {
	const cacheable = pose === STATIC_POSE && style === ICON_STYLE;
	const cached = cacheable ? glyphCache.get(cells) : undefined;
	if (cached) return cached;

	const { filled, light, accent } = renderLogoGrid(cells, pose);
	const glyphs: LogoGlyph[] = [];
	for (let cell = 0; cell < filled.length; cell++) {
		if (!filled[cell]) continue;
		const col = cell % cells;
		const row = Math.floor(cell / cells);
		const green = style.accent === "rim" ? accent[cell] === 1 : cellHash(cell, Math.floor(cell / 7)) < SCATTER_SHARE;
		glyphs.push(...glyphShapes(logoChar(light[cell]), col + 0.5, row + 0.5, green, style.weight));
	}

	if (cacheable) glyphCache.set(cells, glyphs);
	return glyphs;
}
