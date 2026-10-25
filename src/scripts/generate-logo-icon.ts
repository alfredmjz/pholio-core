import * as fs from "fs";
import * as path from "path";
import { deflateSync } from "zlib";
import { STATIC_POSE, glyphGridSize, logoGlyphs, type LogoGlyph, type LogoPose } from "@/lib/ascii-logo";

// Paper, ink and accent from the light theme in styles/globals.css.
const PAPER: Rgb = [243, 239, 231];
const INK: Rgb = [28, 27, 23];
const ACCENT: Rgb = [11, 111, 81];
const hex = (rgb: Rgb) => `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

// The mark fills 84% of its paper tile, matching the browser-tab size it was designed at.
const MARK_SHARE = 0.84;
// 16 characters across, the grid the app icon was designed at.
const ICON_CELLS = glyphGridSize(47);
const ICON_SIZE = 256;
const GIF_SIZE = 128;
const GIF_FRAMES = 48;
const GIF_DELAY_CS = 11;
const SUPERSAMPLE = 4;
// Each colour channel blends paper, ink and accent in this many steps; GIF allows 256 colours.
const SHADES = 15;

type Rgb = [number, number, number];
type Coverage = { ink: Float32Array; accent: Float32Array; tile: Float32Array };

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function crc32(bytes: Buffer) {
	let crc = 0xffffffff;
	for (let index = 0; index < bytes.length; index++) crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

function encodePng(size: number, rgba: Uint8Array) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header.set([8, 6, 0, 0, 0], 8);

	const rows = Buffer.alloc(size * (size * 4 + 1));
	for (let row = 0; row < size; row++) {
		rows.set(rgba.subarray(row * size * 4, (row + 1) * size * 4), row * (size * 4 + 1) + 1);
	}

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", header),
		chunk("IDAT", deflateSync(rows)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

// Variable-width LZW as the GIF spec defines it (the same scheme as the classic gif.js encoder).
function lzw(indices: Uint8Array, minCodeSize: number) {
	const clearCode = 1 << minCodeSize;
	const endCode = clearCode + 1;
	const bytes: number[] = [];
	const table = new Map<number, number>();
	let codeSize = minCodeSize + 1;
	let maxCode = (1 << codeSize) - 1;
	let nextCode = endCode + 1;
	let resetSize = false;
	let bits = 0;
	let bitCount = 0;

	const output = (code: number) => {
		bits |= code << bitCount;
		bitCount += codeSize;
		while (bitCount >= 8) {
			bytes.push(bits & 0xff);
			bits >>>= 8;
			bitCount -= 8;
		}
		if (nextCode > maxCode || resetSize) {
			if (resetSize) {
				codeSize = minCodeSize + 1;
				resetSize = false;
			} else {
				codeSize++;
			}
			maxCode = codeSize === 12 ? 4096 : (1 << codeSize) - 1;
		}
	};

	output(clearCode);
	let prefix = indices[0];
	for (let index = 1; index < indices.length; index++) {
		const key = (prefix << 8) | indices[index];
		const known = table.get(key);
		if (known !== undefined) {
			prefix = known;
			continue;
		}
		output(prefix);
		prefix = indices[index];
		if (nextCode < 4096) {
			table.set(key, nextCode++);
		} else {
			table.clear();
			nextCode = endCode + 1;
			resetSize = true;
			output(clearCode);
		}
	}
	output(prefix);
	output(endCode);
	if (bitCount > 0) bytes.push(bits & 0xff);

	const blocks: number[] = [minCodeSize];
	for (let start = 0; start < bytes.length; start += 255) {
		const block = bytes.slice(start, start + 255);
		blocks.push(block.length, ...block);
	}
	blocks.push(0);
	return Buffer.from(blocks);
}

function encodeGif(size: number, palette: Rgb[], transparent: number, frames: Uint8Array[], delayCs: number) {
	const screen = Buffer.alloc(13);
	screen.write("GIF89a", 0, "ascii");
	screen.writeUInt16LE(size, 6);
	screen.writeUInt16LE(size, 8);
	screen[10] = 0xf7;

	const colours = Buffer.alloc(256 * 3);
	palette.forEach((rgb, index) => colours.set(rgb, index * 3));

	const loop = Buffer.concat([
		Buffer.from([0x21, 0xff, 0x0b]),
		Buffer.from("NETSCAPE2.0", "ascii"),
		Buffer.from([0x03, 0x01, 0x00, 0x00, 0x00]),
	]);

	const parts = [screen, colours, loop];
	for (const frame of frames) {
		const control = Buffer.from([0x21, 0xf9, 0x04, 0x09, delayCs & 0xff, delayCs >> 8, transparent, 0x00]);
		const descriptor = Buffer.alloc(10);
		descriptor[0] = 0x2c;
		descriptor.writeUInt16LE(size, 5);
		descriptor.writeUInt16LE(size, 7);
		parts.push(control, descriptor, lzw(frame, 8));
	}
	parts.push(Buffer.from([0x3b]));
	return Buffer.concat(parts);
}

function glyphSvg(glyph: LogoGlyph) {
	const fill = hex(glyph.accent ? ACCENT : INK);
	const n = (value: number) => Number(value.toFixed(3));
	return glyph.shape === "circle"
		? `<circle cx="${n(glyph.x)}" cy="${n(glyph.y)}" r="${n(glyph.r)}" fill="${fill}"/>`
		: `<rect x="${n(glyph.x)}" y="${n(glyph.y)}" width="${n(glyph.width)}" height="${n(glyph.height)}" fill="${fill}"/>`;
}

function faviconSvg() {
	const cells = glyphGridSize(16 * MARK_SHARE);
	const markSize = 32 * MARK_SHARE;
	const offset = (32 - markSize) / 2;
	const glyphs = logoGlyphs(cells).map(glyphSvg).join("\n    ");

	return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="7" fill="${hex(PAPER)}"/>
  <g transform="translate(${offset.toFixed(2)} ${offset.toFixed(2)}) scale(${(markSize / cells).toFixed(4)})">
    ${glyphs}
  </g>
</svg>
`;
}

function covers(glyph: LogoGlyph, x: number, y: number) {
	if (glyph.shape === "circle") return Math.hypot(x - glyph.x, y - glyph.y) <= glyph.r;
	return x >= glyph.x && x <= glyph.x + glyph.width && y >= glyph.y && y <= glyph.y + glyph.height;
}

function roundedTileCoverage(size: number, x: number, y: number) {
	const radius = size * 0.22;
	const inset = (value: number) => Math.max(radius - value, value - (size - radius), 0);
	return Math.min(1, Math.max(0, radius - Math.hypot(inset(x), inset(y)) + 0.5));
}

// How much of each pixel the paper tile, the ink glyphs and the accent glyphs cover.
function rasterize(size: number, pose: LogoPose): Coverage {
	const markSize = size * MARK_SHARE;
	const offset = (size - markSize) / 2;
	const scale = markSize / ICON_CELLS;
	const ink = new Float32Array(size * size);
	const accent = new Float32Array(size * size);
	const tile = new Float32Array(size * size);

	for (const glyph of logoGlyphs(ICON_CELLS, pose)) {
		const target = glyph.accent ? accent : ink;
		const [left, top, right, bottom] =
			glyph.shape === "circle"
				? [glyph.x - glyph.r, glyph.y - glyph.r, glyph.x + glyph.r, glyph.y + glyph.r]
				: [glyph.x, glyph.y, glyph.x + glyph.width, glyph.y + glyph.height];

		for (let row = Math.floor(top * scale + offset); row < Math.ceil(bottom * scale + offset); row++) {
			for (let col = Math.floor(left * scale + offset); col < Math.ceil(right * scale + offset); col++) {
				let hits = 0;
				for (let sy = 0; sy < SUPERSAMPLE; sy++) {
					for (let sx = 0; sx < SUPERSAMPLE; sx++) {
						const x = (col + (sx + 0.5) / SUPERSAMPLE - offset) / scale;
						const y = (row + (sy + 0.5) / SUPERSAMPLE - offset) / scale;
						if (covers(glyph, x, y)) hits++;
					}
				}
				const pixel = row * size + col;
				target[pixel] = Math.min(1, target[pixel] + hits / (SUPERSAMPLE * SUPERSAMPLE));
			}
		}
	}

	for (let pixel = 0; pixel < size * size; pixel++) {
		accent[pixel] = Math.min(accent[pixel], 1 - ink[pixel]);
		tile[pixel] = roundedTileCoverage(size, (pixel % size) + 0.5, Math.floor(pixel / size) + 0.5);
	}

	return { ink, accent, tile };
}

const blend = (inkShare: number, accentShare: number): Rgb =>
	[0, 1, 2].map((channel) =>
		Math.round(PAPER[channel] * (1 - inkShare - accentShare) + INK[channel] * inkShare + ACCENT[channel] * accentShare)
	) as Rgb;

function iconPng() {
	const { ink, accent, tile } = rasterize(ICON_SIZE, STATIC_POSE);
	const rgba = new Uint8Array(ICON_SIZE * ICON_SIZE * 4);
	for (let pixel = 0; pixel < ICON_SIZE * ICON_SIZE; pixel++) {
		rgba.set([...blend(ink[pixel], accent[pixel]), Math.round(tile[pixel] * 255)], pixel * 4);
	}
	return encodePng(ICON_SIZE, rgba);
}

// The login page's sway as a looping GIF for emails. The loop starts at the still pose, since some
// clients (Outlook on Windows) only ever show the first frame.
function emailGif() {
	const palette: Rgb[] = [];
	const paletteIndex = new Map<string, number>();
	for (let inkStep = 0; inkStep <= SHADES; inkStep++) {
		for (let accentStep = 0; accentStep <= SHADES - inkStep; accentStep++) {
			paletteIndex.set(`${inkStep},${accentStep}`, palette.length);
			palette.push(blend(inkStep / SHADES, accentStep / SHADES));
		}
	}
	const transparent = palette.length;
	palette.push([255, 255, 255]);

	const start = Math.asin((STATIC_POSE.yaw + 0.15) / 0.45);
	const frames = Array.from({ length: GIF_FRAMES }, (_, frame) => {
		const angle = start + (frame / GIF_FRAMES) * Math.PI * 2;
		const { ink, accent, tile } = rasterize(GIF_SIZE, {
			yaw: -0.15 + 0.45 * Math.sin(angle),
			pitch: 0.3 + 0.1 * Math.sin(angle),
		});
		const indices = new Uint8Array(GIF_SIZE * GIF_SIZE);
		for (let pixel = 0; pixel < indices.length; pixel++) {
			if (tile[pixel] < 0.5) {
				indices[pixel] = transparent;
				continue;
			}
			const inkStep = Math.round(ink[pixel] * SHADES);
			const accentStep = Math.min(Math.round(accent[pixel] * SHADES), SHADES - inkStep);
			indices[pixel] = paletteIndex.get(`${inkStep},${accentStep}`) ?? 0;
		}
		return indices;
	});

	return encodeGif(GIF_SIZE, palette, transparent, frames, GIF_DELAY_CS);
}

const publicDir = path.join(import.meta.dir, "..", "public");
const write = (name: string, contents: string | Buffer) => {
	fs.writeFileSync(path.join(publicDir, name), contents);
	console.log(`Wrote public/${name} (${Math.round(Buffer.byteLength(contents) / 1024)} KB)`);
};

write("pholio-icon.svg", faviconSvg());
write("pholio-icon.png", iconPng());
write("pholio-icon.gif", emailGif());
