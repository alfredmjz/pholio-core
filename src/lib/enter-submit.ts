import type { KeyboardEvent } from "react";

/**
 * Shared Enter-to-submit handler for dialogs whose primary action is a plain
 * button (not a `type="submit"` inside a `<form>`).
 *
 * Enter submits from text fields, type cards, and anywhere in the dialog body.
 * It deliberately defers to controls that own Enter themselves so keyboard users
 * keep native behaviour:
 *  - multi-line fields (newline) and IME composition;
 *  - textareas, open menus/listboxes/popovers (picks the highlighted item);
 *  - disclosure triggers (select/date/combobox), switches, and the dialog's own
 *    submit/cancel buttons.
 */
export function handleEnterSubmit(event: KeyboardEvent<HTMLElement>, onSubmit: () => void): void {
	if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
	// A child control (e.g. an autocomplete suggestion) already handled this
	// Enter. Don't also trigger the primary action.
	if (event.defaultPrevented) return;

	const target = event.target as HTMLElement | null;
	if (!target) return;
	if (target.tagName === "TEXTAREA" || target.isContentEditable) return;

	// An open menu/listbox/popover owns Enter, and a link should follow its href.
	if (
		target.closest(
			"a, [data-radix-popper-content-wrapper], [role='menuitem'], [role='option'], [role='listbox'], [role='menu']"
		)
	) {
		return;
	}

	const button = target.closest("button");
	if (button) {
		// Explicit opt-out for in-dialog action buttons (e.g. "Set to Max").
		if (button.hasAttribute("data-dialog-ignore-enter")) return;
		// Native activation already handles these.
		if (button.getAttribute("type") === "submit") return;
		if (button.getAttribute("role") === "switch") return;
		if (button.getAttribute("role") === "tab") return;
		// Disclosure triggers (Radix select/date/combobox popovers).
		if (button.hasAttribute("aria-haspopup") || button.hasAttribute("aria-expanded")) return;
		if (button.querySelector("[data-dialog-submit], [data-dialog-dismiss]")) return;
	}

	event.preventDefault();
	onSubmit();
}
