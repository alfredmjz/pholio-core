"use client";

import { useEffect, useRef } from "react";
import { isTypingTarget, matchesShortcut, ShortcutKey } from "@/lib/keyboard-shortcuts";

interface UseKeyboardShortcutOptions {
	/** When false the listener is not attached. */
	enabled?: boolean;
	/**
	 * Ignore the gesture while a focused transaction row has it, because the row
	 * handles Shift+Enter itself (opening the edit dialog).
	 */
	ignoreTransactionRows?: boolean;
}

const TRANSACTION_ROW_SELECTOR = '[data-shortcut-scope="transaction-row"]';

export function useKeyboardShortcut(
	keys: ShortcutKey[],
	handler: () => void,
	options: UseKeyboardShortcutOptions = {}
) {
	const { enabled = true, ignoreTransactionRows = false } = options;

	const handlerRef = useRef(handler);
	handlerRef.current = handler;
	const keysRef = useRef(keys);
	keysRef.current = keys;

	useEffect(() => {
		if (!enabled) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (!matchesShortcut(event, keysRef.current)) return;
			if (isTypingTarget(event.target)) return;

			const target = event.target as HTMLElement | null;
			if (ignoreTransactionRows && target?.closest?.(TRANSACTION_ROW_SELECTOR)) return;

			event.preventDefault();
			handlerRef.current();
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [enabled, ignoreTransactionRows]);
}
