/** "0:42" or "12:05": a minutes-and-seconds countdown, rounded up so it never shows 0:00 early. */
export function formatCountdown(seconds: number): string {
	const total = Math.max(0, Math.ceil(seconds));
	const minutes = Math.floor(total / 60);
	const rest = total % 60;
	return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
