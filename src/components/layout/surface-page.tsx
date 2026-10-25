"use client";

import { LedgerField } from "@/components/common/ledger-field";
import { WeatherBackdrop } from "@/components/common/weather/weather-backdrop";
import { useBackdrop, useWeather } from "@/components/providers/weather-provider";
import { cn } from "@/lib/utils";
import { useFormatSettings } from "@/components/providers/format-provider";

interface SurfacePageProps {
	children: React.ReactNode;
	/** Classes for the content column (spacing, max width). */
	className?: string;
}

/**
 * A redesigned page: the paper backdrop pinned behind the content (today's financial weather,
 * the wind lines or nothing, as the user chose), and a centred content column on top.
 * Styles live in src/styles/surfaces.css.
 */
export function SurfacePage({ children, className }: SurfacePageProps) {
	useFormatSettings();
	const { backdrop } = useBackdrop();
	const weather = useWeather();

	return (
		<div className="surface relative isolate min-h-full w-full">
			<div className="surface-backdrop" aria-hidden data-backdrop={backdrop} data-weather={weather ?? undefined}>
				{backdrop === "adaptive" && <WeatherBackdrop className="surface-backdrop-canvas" />}
				{backdrop === "wind" && <LedgerField className="surface-backdrop-canvas" />}
			</div>
			<div
				className={cn(
					"surface-content relative z-10 mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-4 pb-16 pt-6 md:gap-10 md:px-8 md:pt-10",
					className
				)}
			>
				{children}
			</div>
		</div>
	);
}
