"use client";

import { cn } from "@/lib/utils";
import { SHORTCUT_KEY_SYMBOL, ShortcutKey } from "@/lib/keyboard-shortcuts";

type ShortcutHintSize = "sm" | "md";
type ShortcutHintVariant = "keycap" | "plain";

interface ShortcutHintProps {
	keys: ShortcutKey[];
	className?: string;
	/** Extra classes applied to each token (e.g. to adapt to a coloured button). */
	keyClassName?: string;
	/** "sm" for buttons, "md" for legends where visibility matters more. */
	size?: ShortcutHintSize;
	/** "keycap" draws a bordered key box; "plain" shows the bare glyph/icon. */
	variant?: ShortcutHintVariant;
	/**
	 * Marks the button this hint sits inside so Enter-to-submit can defer to the
	 * button's native activation instead of also submitting.
	 */
	hintRole?: "submit" | "dismiss";
}

const KEYCAP_SIZE: Record<ShortcutHintSize, string> = {
	sm: "h-5 min-w-5 px-1 text-xs",
	md: "h-7 min-w-7 px-2 text-sm",
};

const GLYPH_SIZE: Record<ShortcutHintSize, string> = {
	sm: "text-sm",
	md: "text-base",
};

const ICON_SIZE: Record<ShortcutHintSize, string> = {
	sm: "h-4 w-4",
	md: "h-5 w-5",
};

function LeftMouseButtonIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			className={className}
			fill="none"
			stroke="currentColor"
			strokeWidth="1.9"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect x="6" y="2.5" width="12" height="19" rx="4.5" />
			<path d="M12 2.5v7" />
			<path d="M6 9.5V7a4.5 4.5 0 0 1 4.5-4.5H12V9.5Z" fill="currentColor" stroke="none" opacity="0.55" />
		</svg>
	);
}

function ShortcutToken({
	token,
	size,
	variant,
	keyClassName,
}: {
	token: ShortcutKey;
	size: ShortcutHintSize;
	variant: ShortcutHintVariant;
	keyClassName?: string;
}) {
	const isMouse = token === ShortcutKey.LeftClick;
	const content = isMouse ? (
		<LeftMouseButtonIcon className={ICON_SIZE[size]} />
	) : (
		SHORTCUT_KEY_SYMBOL[token]
	);

	if (variant === "plain") {
		return (
			<span
				className={cn(
					"inline-flex items-center justify-center font-sans font-semibold leading-none text-primary/80",
					GLYPH_SIZE[size],
					keyClassName
				)}
			>
				{content}
			</span>
		);
	}

	return (
		<kbd
			className={cn(
				"inline-flex items-center justify-center rounded-md border border-border bg-muted font-sans font-semibold leading-none text-primary",
				KEYCAP_SIZE[size],
				keyClassName
			)}
		>
			{content}
		</kbd>
	);
}

export function ShortcutHint({
	keys,
	className,
	keyClassName,
	size = "sm",
	variant = "keycap",
	hintRole,
}: ShortcutHintProps) {
	// Keyboard chords (e.g. ⇧ ↵) render as adjacent keys; only a mouse action
	// is joined with a "+" so the pointer step is unambiguous.
	const usesMouse = keys.includes(ShortcutKey.LeftClick);

	return (
		<span
			className={cn("inline-flex items-center gap-1", className)}
			data-dialog-submit={hintRole === "submit" ? "" : undefined}
			data-dialog-dismiss={hintRole === "dismiss" ? "" : undefined}
		>
			{keys.map((token, index) => (
				<span key={`${token}-${index}`} className="inline-flex items-center gap-1">
					{index > 0 && usesMouse && <span className="opacity-70">+</span>}
					<ShortcutToken token={token} size={size} variant={variant} keyClassName={keyClassName} />
				</span>
			))}
		</span>
	);
}
