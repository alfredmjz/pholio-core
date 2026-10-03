"use client";

import { ShortcutHint } from "@/components/common/shortcut-hint";
import { ShortcutKey } from "@/lib/keyboard-shortcuts";

/** Esc key hint to place inside a dialog's cancel/dismiss button. */
export function CancelShortcut() {
	return <ShortcutHint keys={[ShortcutKey.Escape]} hintRole="dismiss" />;
}

/**
 * Enter key hint to place inside a dialog's primary submit/confirm button.
 * Uses the button's own text colour so it never camouflages.
 */
export function SubmitShortcut() {
	return (
		<ShortcutHint
			keys={[ShortcutKey.Enter]}
			keyClassName="border-current bg-transparent text-current"
			hintRole="submit"
		/>
	);
}
