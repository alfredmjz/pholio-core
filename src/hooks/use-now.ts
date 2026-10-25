import { useEffect, useState } from "react";

/**
 * The current time, ticking every `intervalMs`. Starts at `initial` (the server's render time) so
 * the server and the hydrating client render the same text, then moves to the device clock.
 */
export function useNow(initial: number, intervalMs = 60_000): number {
	const [now, setNow] = useState(initial);

	useEffect(() => {
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
		return () => window.clearInterval(timer);
	}, [intervalMs]);

	return now;
}
