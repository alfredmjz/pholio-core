/**
 * Logo Caching API Route
 *
 * Proxies requests to logo.dev API and caches responses in Redis.
 * Benefits:
 * - Reduces external API calls
 * - Faster subsequent loads for all users
 * - API token hidden from client
 *
 * Cache TTL: 7 days (logos rarely change)
 */

import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";

// Response type for cached logos
interface CachedLogo {
	/** Base64 encoded image data */
	data: string;
	/** Content-Type header from original response */
	contentType: string;
	/** Timestamp when cached */
	cachedAt: number;
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ domain: string }> }
) {
	const { domain } = await params;

	if (!domain) {
		return NextResponse.json({ error: "Domain is required" }, { status: 400 });
	}

	// Normalize domain (remove protocol, trailing slashes, etc.)
	const normalizedDomain = domain
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/\/$/, "");

	const cacheKey = CACHE_KEYS.logo(normalizedDomain);

	// 1. Try to get from Redis cache first
	try {
		const cached = await cacheGet(cacheKey);
		if (cached) {
			const parsedCache: CachedLogo = JSON.parse(cached);

			// Return cached image with appropriate headers
			const imageBuffer = Buffer.from(parsedCache.data, "base64");
			return new NextResponse(imageBuffer, {
				status: 200,
				headers: {
					"Content-Type": parsedCache.contentType,
					"Cache-Control": "public, max-age=604800, immutable", // 7 days browser cache
					"X-Cache": "HIT",
				},
			});
		}
	} catch (error) {
		console.warn("[Logo API] Cache read error:", error);
		// Continue to fetch from origin
	}

	// 2. Fetch from logo.dev API
	const logoDevToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

	if (!logoDevToken) {
		console.warn("[Logo API] NEXT_PUBLIC_LOGO_DEV_TOKEN not configured");
		return NextResponse.json(
			{ error: "Logo service not configured" },
			{ status: 503 }
		);
	}

	const logoUrl = `https://img.logo.dev/${normalizedDomain}?token=${logoDevToken}`;

	try {
		const response = await fetch(logoUrl, {
			headers: {
				Accept: "image/*",
			},
		});

		if (!response.ok) {
			// Logo not found or error from logo.dev
			return NextResponse.json(
				{ error: "Logo not found" },
				{ status: response.status }
			);
		}

		const contentType = response.headers.get("content-type") || "image/png";
		const imageBuffer = await response.arrayBuffer();
		const base64Data = Buffer.from(imageBuffer).toString("base64");

		// 3. Cache the result in Redis (async, don't block response)
		const cacheData: CachedLogo = {
			data: base64Data,
			contentType,
			cachedAt: Date.now(),
		};

		cacheSet(cacheKey, JSON.stringify(cacheData), { ttl: CACHE_TTL.LOGO }).catch(
			(err) => console.error("[Logo API] Failed to cache logo:", err)
		);

		// 4. Return the image
		return new NextResponse(Buffer.from(imageBuffer), {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=604800, immutable", // 7 days browser cache
				"X-Cache": "MISS",
			},
		});
	} catch (error) {
		console.error("[Logo API] Error fetching logo:", error);
		return NextResponse.json(
			{ error: "Failed to fetch logo" },
			{ status: 500 }
		);
	}
}
