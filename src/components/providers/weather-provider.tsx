"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getFinancialWeather } from "@/lib/actions/weather-actions";
import { backdropCookie, DEFAULT_BACKDROP, type BackdropPreference } from "@/lib/backdrop-preference";
import type { Weather } from "@/lib/financial-weather";

interface WeatherContextValue {
	/** Null until it is known, and whenever the backdrop is not adaptive. */
	weather: Weather | null;
	backdrop: BackdropPreference;
	setBackdrop: (next: BackdropPreference) => void;
}

const WeatherContext = createContext<WeatherContextValue>({
	weather: null,
	backdrop: DEFAULT_BACKDROP,
	setBackdrop: () => {},
});

// The server starts on the weather at page load; this resolves it without holding the page up.
export function WeatherProvider({
	weather,
	backdrop: initialBackdrop,
	children,
}: {
	weather: Promise<Weather | null>;
	backdrop: BackdropPreference;
	children: React.ReactNode;
}) {
	const [backdrop, setBackdropState] = useState(initialBackdrop);
	const [current, setCurrent] = useState<Weather | null>(null);

	useEffect(() => {
		let active = true;
		// A promise passed from the server arrives as a bare thenable, so wrap it before chaining.
		Promise.resolve(weather)
			.then((value) => active && value && setCurrent(value))
			.catch(() => active && setCurrent("cloudy"));
		return () => {
			active = false;
		};
	}, [weather]);

	const setBackdrop = useCallback(
		(next: BackdropPreference) => {
			document.cookie = backdropCookie(next);
			setBackdropState(next);
			// The server skipped the weather for the other backdrops, so fetch it on switching back.
			if (next === "adaptive" && !current) {
				getFinancialWeather()
					.then((value) => value && setCurrent(value))
					.catch(() => setCurrent("cloudy"));
			}
		},
		[current]
	);

	return (
		<WeatherContext.Provider value={{ weather: backdrop === "adaptive" ? current : null, backdrop, setBackdrop }}>
			{children}
		</WeatherContext.Provider>
	);
}

export function useWeather(): Weather | null {
	return useContext(WeatherContext).weather;
}

export function useBackdrop(): Pick<WeatherContextValue, "backdrop" | "setBackdrop"> {
	const { backdrop, setBackdrop } = useContext(WeatherContext);
	return { backdrop, setBackdrop };
}
