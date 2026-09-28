import type { KeyboardEvent } from "react";

/**
 * Shared Enter-to-submit handler for dialogs whose primary action is a plain
 * button (not a `type="submit"` inside a `<form>`).
 *
 * Ignores newlines in textareas/rich text, avoids hijacking Enter on buttons,
 * and respects IME composition.
 */
export function handleEnterSubmit(event: KeyboardEvent<HTMLElement>, onSubmit: () => void): void {
	if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;

	const target = event.target as HTMLElement | null;
	if (!target) return;
	if (target.tagName === "TEXTAREA" || target.isContentEditable) return;
	if (target.closest("button, a, [role='menuitem'], [role='option']")) return;

	event.preventDefault();
	onSubmit();
}
