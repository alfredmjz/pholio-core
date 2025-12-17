/**
 * Redis Client Utility
 *
 * Provides a Redis client using Bun's native Redis support.
 * Handles connection errors gracefully with fallback behavior.
 *
 * @see https://bun.sh/docs/runtime/redis
 */

// Types for cache operations
export interface CacheOptions {
	/** Time-to-live in seconds */
	ttl?: number;
}

// Default TTL values (in seconds)
export const CACHE_TTL = {
	LOGO: 7 * 24 * 60 * 60, // 7 days - logos rarely change
	USER_PREFERENCES: 30 * 24 * 60 * 60, // 30 days
	SHORT: 5 * 60, // 5 minutes
} as const;

// Cache key prefixes for namespacing
export const CACHE_KEYS = {
	logo: (domain: string) => `logo:${domain}`,
	userPreferences: (userId: string) => `user:${userId}:preferences`,
} as const;

// Define the Redis client type
type BunRedisClient = {
	ping: () => Promise<string>;
	get: (key: string) => Promise<string | null>;
	set: (key: string, value: string) => Promise<void>;
	expire: (key: string, seconds: number) => Promise<void>;
	del: (key: string) => Promise<void>;
	exists: (key: string) => Promise<number>;
};

/**
 * Redis client singleton
 * Uses the default client which reads from REDIS_URL environment variable
 * Falls back to redis://localhost:6379 if not set
 */
let redisClient: BunRedisClient | null = null;
let connectionFailed = false;
let bunRedis: BunRedisClient | null = null;

/**
 * Lazy load Bun's Redis client
 * This allows the module to be imported even in non-Bun environments
 */
async function getBunRedis(): Promise<BunRedisClient | null> {
	if (bunRedis) return bunRedis;

	try {
		// Dynamic import to avoid issues in non-Bun environments (e.g., during Next.js build)
		const bunModule = await import("bun");
		if (bunModule.redis) {
			bunRedis = bunModule.redis as unknown as BunRedisClient;
			return bunRedis;
		}
	} catch {
		// Not running in Bun or Redis not available
		console.warn("[Redis] Bun Redis not available in this environment");
	}
	return null;
}

/**
 * Get the Redis client instance
 * Returns null if Redis is not available
 */
export async function getRedisClient(): Promise<BunRedisClient | null> {
	// If we've already determined Redis is unavailable, return null immediately
	if (connectionFailed) {
		return null;
	}

	if (!redisClient) {
		try {
			// Get the Bun Redis client
			const client = await getBunRedis();
			if (!client) {
				connectionFailed = true;
				return null;
			}
			// Test the connection
			await client.ping();
			redisClient = client;
			console.log("[Redis] Connected successfully");
		} catch (error) {
			console.warn("[Redis] Connection failed, caching disabled:", error);
			connectionFailed = true;
			return null;
		}
	}

	return redisClient;
}

/**
 * Get a value from Redis cache
 * Returns null if key doesn't exist or Redis is unavailable
 */
export async function cacheGet(key: string): Promise<string | null> {
	try {
		const client = await getRedisClient();
		if (!client) return null;

		const value = await client.get(key);
		return value;
	} catch (error) {
		console.error("[Redis] Error getting key:", key, error);
		return null;
	}
}

/**
 * Set a value in Redis cache with optional TTL
 */
export async function cacheSet(
	key: string,
	value: string,
	options?: CacheOptions
): Promise<boolean> {
	try {
		const client = await getRedisClient();
		if (!client) return false;

		await client.set(key, value);

		if (options?.ttl) {
			await client.expire(key, options.ttl);
		}

		return true;
	} catch (error) {
		console.error("[Redis] Error setting key:", key, error);
		return false;
	}
}

/**
 * Delete a key from Redis cache
 */
export async function cacheDelete(key: string): Promise<boolean> {
	try {
		const client = await getRedisClient();
		if (!client) return false;

		await client.del(key);
		return true;
	} catch (error) {
		console.error("[Redis] Error deleting key:", key, error);
		return false;
	}
}

/**
 * Check if a key exists in Redis cache
 */
export async function cacheExists(key: string): Promise<boolean> {
	try {
		const client = await getRedisClient();
		if (!client) return false;

		const exists = await client.exists(key);
		return exists === 1;
	} catch (error) {
		console.error("[Redis] Error checking key existence:", key, error);
		return false;
	}
}

/**
 * Get a cached value or compute and cache it if not present
 * This is the primary pattern for caching - "cache-aside" pattern
 */
export async function cacheGetOrSet<T>(
	key: string,
	fetchFn: () => Promise<T>,
	options?: CacheOptions & { serialize?: (value: T) => string; deserialize?: (value: string) => T }
): Promise<T> {
	const { serialize = JSON.stringify, deserialize = JSON.parse, ttl } = options || {};

	// Try to get from cache first
	const cached = await cacheGet(key);
	if (cached !== null) {
		try {
			return deserialize(cached);
		} catch {
			// If deserialization fails, fetch fresh data
			console.warn("[Redis] Failed to deserialize cached value, fetching fresh:", key);
		}
	}

	// Fetch fresh data
	const fresh = await fetchFn();

	// Cache the result (don't await to avoid blocking)
	cacheSet(key, serialize(fresh), { ttl }).catch((err) =>
		console.error("[Redis] Failed to cache value:", key, err)
	);

	return fresh;
}

/**
 * Reset the Redis connection state
 * Useful for retrying after a connection failure
 */
export function resetRedisConnection(): void {
	redisClient = null;
	connectionFailed = false;
}
