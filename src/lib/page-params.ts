// Query parameters each signed-in section reads; any other one in a typed or reloaded URL is dropped.
const SECTION_PARAMS: Record<string, readonly string[]> = {
	"/accounts": [],
	"/allocations": ["month", "year", "transaction"],
	"/dashboard": [],
	"/recurring": [],
	"/settings": [],
};

/** The query without parameters the page does not read, or null when there is nothing to drop. */
export function withoutUnknownParams(pathname: string, params: URLSearchParams): URLSearchParams | null {
	const section = Object.keys(SECTION_PARAMS).find((path) => pathname === path || pathname.startsWith(`${path}/`));
	if (!section) return null;

	const allowed = SECTION_PARAMS[section];
	const kept = new URLSearchParams();
	params.forEach((value, key) => {
		if (allowed.includes(key)) kept.append(key, value);
	});
	return kept.toString() === params.toString() ? null : kept;
}
