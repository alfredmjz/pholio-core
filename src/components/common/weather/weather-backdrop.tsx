"use client";

import { useEffect, useState } from "react";
import { useWeather } from "@/components/providers/weather-provider";
import type { Weather } from "@/lib/financial-weather";
import { cn } from "@/lib/utils";
import { WeatherCanvas } from "./weather-canvas";

const CROSSFADE_MS = 1200;

/** Today's weather behind the page. When the weather changes, the old sky fades out over the new one. */
export function WeatherBackdrop({ className }: { className?: string }) {
	const weather = useWeather();
	const [layers, setLayers] = useState<Weather[]>(() => (weather ? [weather] : []));

	useEffect(() => {
		if (!weather) return;
		setLayers((current) => (current[current.length - 1] === weather ? current : [...current.slice(-1), weather]));
	}, [weather]);

	useEffect(() => {
		if (layers.length < 2) return;
		const timer = window.setTimeout(() => setLayers((current) => current.slice(-1)), CROSSFADE_MS);
		return () => window.clearTimeout(timer);
	}, [layers]);

	return (
		<>
			{layers.map((layer, index) => (
				<WeatherCanvas
					key={layer}
					weather={layer}
					className={cn(className, "weather-layer", index < layers.length - 1 && "weather-layer-leaving")}
				/>
			))}
		</>
	);
}
