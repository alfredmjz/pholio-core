"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

interface UseServerSyncedDataOptions {
	/** Refetch when the tab regains focus or becomes visible. Default true. */
	refreshOnFocus?: boolean;
	/** Debounce window (ms) to coalesce the focus + visibilitychange events. */
	debounceMs?: number;
	/** Run an initial fetch on mount (for data with no server-provided initial value). */
	fetchOnMount?: boolean;
}

/**
 * Keeps a piece of server data fresh in a client component.
 *
 *  - seeds state from `initialValue`;
 *  - re-syncs when `initialValue` changes (server re-render / router.refresh);
 *  - refetches via `fetcher` when the window regains focus or the tab becomes visible
 *    again (cross-tab / cross-device changes);
 *  - optionally fetches once on mount.
 *
 * `fetcher` is a server action or any async function returning `T`. Refetches never
 * throw (background failures must not disrupt the page).
 *
 * IMPORTANT: pass a stable reference for `initialValue`. Server-component props are
 * stable across re-renders; do not pass an inline literal (e.g. `[]`) or the prop-sync
 * effect will loop.
 */
export function useServerSyncedData<T>(
	initialValue: T,
	fetcher: () => Promise<T>,
	options: UseServerSyncedDataOptions = {}
): {
	data: T;
	setData: Dispatch<SetStateAction<T>>;
	refresh: () => Promise<void>;
	isRefreshing: boolean;
} {
	const { refreshOnFocus = true, debounceMs = 300, fetchOnMount = false } = options;

	const [data, setData] = useState<T>(initialValue);
	const [isRefreshing, setIsRefreshing] = useState(fetchOnMount);

	const fetcherRef = useRef(fetcher);
	fetcherRef.current = fetcher;

	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const refresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			setData(await fetcherRef.current());
		} catch {
			// Background refresh must never disrupt the page.
		} finally {
			setIsRefreshing(false);
		}
	}, []);

	const debouncedRefresh = useCallback(() => {
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => {
			void refresh();
		}, debounceMs);
	}, [refresh, debounceMs]);

	// Re-sync when the server passes fresh data (e.g. after router.refresh()).
	useEffect(() => {
		setData(initialValue);
	}, [initialValue]);

	// Initial fetch for data that is not supplied by the server.
	useEffect(() => {
		if (fetchOnMount) void refresh();
	}, [fetchOnMount, refresh]);

	// Refetch on focus / tab visibility so changes made elsewhere show up.
	useEffect(() => {
		if (!refreshOnFocus) return;

		const handle = () => {
			if (document.visibilityState === "visible") debouncedRefresh();
		};

		window.addEventListener("focus", handle);
		document.addEventListener("visibilitychange", handle);
		return () => {
			window.removeEventListener("focus", handle);
			document.removeEventListener("visibilitychange", handle);
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, [refreshOnFocus, debouncedRefresh]);

	return { data, setData, refresh, isRefreshing };
}
