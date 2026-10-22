/**
 * Shared look for dialogs and alert dialogs.
 *
 * Phones get a bottom sheet: anchored to the bottom edge, rounded top corners, a grab handle,
 * and room for the home indicator. From `sm` up it is a centred panel. Centring uses
 * `inset-0 m-auto h-fit` rather than a translate, so the enter animation never jumps.
 */

// A plain tint, no backdrop blur: a full-screen blur is redrawn in software on machines without
// a GPU (and in headless test browsers), which stalls frames while the dialog animates in.
export const DIALOG_OVERLAY_CLASS =
	"fixed inset-0 z-50 bg-overlay/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

export const DIALOG_CONTENT_CLASS = [
	// Phone: bottom sheet
	"fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto overscroll-contain",
	"rounded-t-[24px] border border-b-0 border-border bg-card text-card-foreground shadow-raised outline-none",
	"pb-[env(safe-area-inset-bottom)]",
	"duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out",
	"data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
	// sm+: centred panel
	"sm:inset-0 sm:m-auto sm:h-fit sm:w-[calc(100%-2rem)] sm:max-w-lg sm:max-h-[calc(100dvh-3rem)]",
	"sm:rounded-[22px] sm:border-b sm:pb-0 sm:duration-200",
	"sm:data-[state=open]:slide-in-from-bottom-2 sm:data-[state=closed]:slide-out-to-bottom-2",
	"sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:fade-out-0",
	"sm:data-[state=open]:zoom-in-[0.98] sm:data-[state=closed]:zoom-out-[0.98]",
].join(" ");

/** Grab handle shown only on the phone sheet. */
export const DIALOG_HANDLE_CLASS = "mx-auto mt-2.5 block h-1 w-10 rounded-full bg-border-strong/70 sm:hidden";

export const DIALOG_BODY_PAD = "px-5 pb-5 pt-4 sm:p-7";
