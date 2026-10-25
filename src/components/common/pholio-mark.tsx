import { glyphGridSize, logoGlyphs } from "@/lib/ascii-logo";
import { cn } from "@/lib/utils";

interface PholioMarkProps {
	size?: number;
	className?: string;
}

export function PholioMark({ size = 22, className }: PholioMarkProps) {
	const cells = glyphGridSize(size);

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${cells} ${cells}`}
			aria-hidden
			className={cn("shrink-0 text-primary", className)}
		>
			{logoGlyphs(cells).map((glyph, index) => {
				const fill = glyph.accent ? "hsl(var(--accent))" : "currentColor";
				return glyph.shape === "circle" ? (
					<circle key={index} cx={glyph.x} cy={glyph.y} r={glyph.r} fill={fill} />
				) : (
					<rect key={index} x={glyph.x} y={glyph.y} width={glyph.width} height={glyph.height} fill={fill} />
				);
			})}
		</svg>
	);
}
