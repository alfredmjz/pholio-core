"use client";

import { ShortcutHint } from "@/components/common/shortcut-hint";
import { ShortcutKey } from "@/lib/keyboard-shortcuts";

/** Esc key hint to place inside a dialog's cancel/dismiss button. */
export function CancelShortcut() {
	return (
		<ShortcutHint
			keys={[ShortcutKey.Escape]}
			keyClassName="h-[18px] rounded-[5px] border-border bg-transparent px-1 text-[10px] font-medium text-muted-foreground"
			hintRole="dismiss"
		/>
	);
}

/**
 * Enter key hint to place inside a dialog's primary submit/confirm button.
 * Uses the button's own text colour so it never camouflages.
 */
export function SubmitShortcut() {
	return (
		<ShortcutHint
			keys={[ShortcutKey.Enter]}
			keyClassName="h-[18px] min-w-[18px] rounded-[5px] border-current bg-transparent px-1 text-[11px] font-medium text-current opacity-80"
			hintRole="submit"
		/>
	);
}
