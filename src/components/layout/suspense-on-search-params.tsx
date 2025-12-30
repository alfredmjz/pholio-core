import { Suspense, ReactNode } from "react";

interface SuspenseOnSearchParamsProps {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
	fallback: ReactNode;
	children: ReactNode;
	/**
	 * Optional list of keys to include in the cache key.
	 * If provided, only these params will trigger a suspense re-render.
	 * If omitted, ALL params will trigger it.
	 */
	filterParams?: string[];
}

/**
 * A wrapper component that forces a Suspense boundary to reset key
 * when search parameters change. This is critical for showing loading
 * skeletons on "soft" navigations like changing a year/month filter.
 */
export async function SuspenseOnSearchParams({
	searchParams,
	fallback,
	children,
	filterParams,
}: SuspenseOnSearchParamsProps) {
	const params = await searchParams;

	let cacheKey = "";

	if (filterParams && filterParams.length > 0) {
		// Only use specific params for the key
		const filteredObj: Record<string, any> = {};
		filterParams.sort().forEach((key) => {
			filteredObj[key] = params[key];
		});
		cacheKey = JSON.stringify(filteredObj);
	} else {
		// Use all params, but we should sort logic to ensure stability
		// JSON.stringify handles basic objects but not key order guarantees across environments theoretically,
		// though usually V8 is consistent. To be safe, let's sort keys.
		const keys = Object.keys(params).sort();
		const sortedObj: Record<string, any> = {};
		keys.forEach((key) => {
			sortedObj[key] = params[key];
		});
		cacheKey = JSON.stringify(sortedObj);
	}

	return (
		<div className="flex-1 w-full flex flex-col gap-6 px-4 py-8">
			<Suspense key={cacheKey} fallback={fallback}>
				{children}
			</Suspense>
		</div>
	);
}
