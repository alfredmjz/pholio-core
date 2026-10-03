/**
 * Shared keyboard and mouse shortcut definitions.
 *
 * Keep every gesture and its display glyph here so shortcut legends and action
 * buttons stay consistent across pages (transactions, recurring, ...).
 */

/** A single physical input that can make up a shortcut gesture. */
export enum ShortcutKey {
	Shift = "Shift",
	Ctrl = "Ctrl",
	Enter = "Enter",
	Escape = "Escape",
	LeftClick = "LeftClick",
}

/**
 * Display glyph for each keyboard key. Mouse actions have no glyph and are
 * rendered with an icon instead (see ShortcutHint).
 */
export const SHORTCUT_KEY_SYMBOL: Record<ShortcutKey, string> = {
	[ShortcutKey.Shift]: "⇧",
	[ShortcutKey.Ctrl]: "⌃",
	[ShortcutKey.Enter]: "↵",
	[ShortcutKey.Escape]: "Esc",
	[ShortcutKey.LeftClick]: "",
};

/** Maps non-modifier shortcut keys to the DOM `KeyboardEvent.key` value. */
export const SHORTCUT_EVENT_KEY: Partial<Record<ShortcutKey, string>> = {
	[ShortcutKey.Enter]: "Enter",
	[ShortcutKey.Escape]: "Escape",
};

/** Stable identifiers for the gestures the app supports. */
export enum ShortcutId {
	SortColumn = "sort-column",
	SecondarySort = "secondary-sort",
	OpenTransaction = "open-transaction",
	AddRecurring = "add-recurring",
	AddAccount = "add-account",
}

export interface ShortcutDefinition {
	/** Ordered inputs that make up the gesture. */
	keys: ShortcutKey[];
	/** Short description shown in shortcut legends. */
	label: string;
}

export const SHORTCUTS: Record<ShortcutId, ShortcutDefinition> = {
	[ShortcutId.SortColumn]: {
		keys: [ShortcutKey.LeftClick],
		label: "sort by a column",
	},
	[ShortcutId.SecondarySort]: {
		keys: [ShortcutKey.Shift, ShortcutKey.LeftClick],
		label: "add or remove a secondary sort",
	},
	[ShortcutId.OpenTransaction]: {
		keys: [ShortcutKey.Shift, ShortcutKey.Enter],
		label: "open the transaction dialog",
	},
	[ShortcutId.AddRecurring]: {
		keys: [ShortcutKey.Shift, ShortcutKey.Enter],
		label: "add a recurring expense",
	},
	[ShortcutId.AddAccount]: {
		keys: [ShortcutKey.Shift, ShortcutKey.Enter],
		label: "add an account",
	},
};

/** Keyboard inputs in a gesture (everything except mouse actions). */
export function keyboardKeysOf(keys: ShortcutKey[]): ShortcutKey[] {
	return keys.filter((key) => key !== ShortcutKey.LeftClick);
}

/** Does a native keydown event match a keyboard-only shortcut gesture? */
export function matchesShortcut(event: KeyboardEvent, keys: ShortcutKey[]): boolean {
	const keyboardKeys = keyboardKeysOf(keys);
	if (keyboardKeys.length === 0) return false;

	const wantsShift = keyboardKeys.includes(ShortcutKey.Shift);
	const wantsCtrl = keyboardKeys.includes(ShortcutKey.Ctrl);
	const nonModifiers = keyboardKeys.filter(
		(key) => key !== ShortcutKey.Shift && key !== ShortcutKey.Ctrl
	);

	if (event.shiftKey !== wantsShift) return false;
	if ((event.ctrlKey || event.metaKey) !== wantsCtrl) return false;
	if (nonModifiers.length !== 1) return false;

	return SHORTCUT_EVENT_KEY[nonModifiers[0]] === event.key;
}

/**
 * True when focus is inside a multi-line editing surface, so keyboard shortcuts
 * should be ignored. Single-line inputs and selects are intentionally allowed:
 * Shift+Enter carries no native meaning there, and users expect the global
 * gestures (e.g. open a dialog) to work from a search/filter field.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
	const element = target as HTMLElement | null;
	if (!element) return false;
	return element.tagName === "TEXTAREA" || element.isContentEditable;
}
