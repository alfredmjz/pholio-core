import { NextRequest, NextResponse } from "next/server";
import { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";
import { Logger } from "@/lib/logger";

export interface BrandSearchResult {
	name: string;
	domain: string;
}

/**
 * Proxy endpoint for logo.dev Brand Search API
 * This keeps the secret key server-side while exposing a safe search endpoint
 * Results are cached in Redis to reduce API calls and improve response times
 *
 * GET /api/logos/search?q=amazon
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const query = searchParams.get("q");

	if (!query || query.length < 2) {
		return NextResponse.json({ results: [], error: "Query must be at least 2 characters" }, { status: 400 });
	}

	// Use secret key for search API (different from public token)
	const secretKey = process.env.LOGO_DEV_SECRET_KEY;

	if (!secretKey) {
		Logger.warn("LOGO_DEV_SECRET_KEY not configured");
		return NextResponse.json({ results: [], error: "Search API not configured" }, { status: 503 });
	}

	// Normalize query for consistent caching
	// "Netflix", "netflix", " netflix " all hit the same cache key
	const normalizedQuery = query.toLowerCase().trim();
	const cacheKey = CACHE_KEYS.logoSearch(normalizedQuery);

	try {
		let cacheHit = false;

		const results = await cacheGetOrSet<BrandSearchResult[]>(
			cacheKey,
			async () => {
				// Cache miss - fetch from logo.dev API
				const response = await fetch(`https://api.logo.dev/search?q=${encodeURIComponent(query)}`, {
					headers: {
						Authorization: `Bearer ${secretKey}`,
					},
				});

				if (!response.ok) {
					Logger.error("Error from logo.dev API", { statusCode: response.status, statusText: response.statusText });
					throw new Error(`Search failed: ${response.status}`);
				}

				const data: BrandSearchResult[] = await response.json();
				return data.slice(0, 10); // Max 10 results
			},
			{ ttl: CACHE_TTL.LOGO_SEARCH }
		);

		// Check if this was a cache hit by seeing if we have results without errors
		// The cacheGetOrSet will return cached data if available
		cacheHit = results !== undefined;

		return NextResponse.json(
			{ results },
			{
				headers: {
					"X-Cache": cacheHit ? "HIT" : "MISS",
				},
			}
		);
	} catch (error) {
		Logger.error("Logo Search API Error", { error, statusCode: 500 });
		return NextResponse.json({ results: [], error: "Search failed" }, { status: 500 });
	}
}
