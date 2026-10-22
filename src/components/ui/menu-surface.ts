/**
 * Shared look for every floating list: Select menus, dropdown (action) menus, sub-menus and
 * popovers. One paper sheet with soft corners, roomy rounded rows, a faint ink wash on the
 * highlighted row (no outlines), and a short fade that grows from the trigger.
 */

const MENU_MOTION = [
	"duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out",
	"data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
	"data-[state=open]:zoom-in-[0.97] data-[state=closed]:zoom-out-[0.97]",
	"data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
	"data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1",
].join(" ");

/** The sheet a menu or select list sits on. */
export const MENU_CONTENT_CLASS = [
	"z-50 min-w-[10rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-raised outline-none",
	MENU_MOTION,
].join(" ");

/** A popover holding free content (a calendar, a form), on the same sheet. */
export const POPOVER_CONTENT_CLASS = [
	"z-50 w-72 rounded-2xl border border-border/80 bg-popover p-4 text-popover-foreground shadow-raised outline-none",
	MENU_MOTION,
].join(" ");

/** One row. Radix marks the keyboard/pointer row with data-highlighted. */
export const MENU_ITEM_CLASS =
	"type-body-sm relative flex min-h-9 min-w-0 cursor-default select-none items-center gap-2 rounded-xl px-3 py-2 text-primary outline-none transition-colors data-[highlighted]:bg-primary/[0.05] data-[state=open]:bg-primary/[0.05] data-[disabled]:pointer-events-none data-[disabled]:opacity-40";

export const MENU_LABEL_CLASS = "type-body-xs px-3 pb-1 pt-2 text-muted-foreground";

export const MENU_SEPARATOR_CLASS = "-mx-1.5 my-1.5 h-px bg-border/70";
