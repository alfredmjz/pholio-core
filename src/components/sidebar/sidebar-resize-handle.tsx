"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SidebarResizeHandleProps {
	/** The sidebar element; its width is written directly while dragging so nothing re-renders. */
	targetRef: React.RefObject<HTMLElement | null>;
	widthRem: number;
	isCollapsed: boolean;
	minRem: number;
	maxRem: number;
	collapsedRem: number;
	defaultRem: number;
	onDraggingChange: (dragging: boolean) => void;
	/** Fires once the drag crosses the collapse point (with the live width), so the labels fade as it goes. */
	onCollapsedPreview: (collapsed: boolean, liveRem: number) => void;
	onCommit: (next: { widthRem: number; isCollapsed: boolean }) => void;
}

const REM = 16;
const KEY_STEP_REM = 1;

/**
 * The sidebar's right edge: a hairline that darkens under the pointer, with the resize cursor.
 * It is the only way to resize or collapse the sidebar. While dragging, the width follows the
 * pointer all the way between the collapsed rail and the widest width; let go below the minimum
 * and it eases to the rail or the minimum, whichever is nearer. Double-click resets; with focus,
 * the arrow keys resize (left at the minimum collapses, right from collapsed expands).
 */
export function SidebarResizeHandle({
	targetRef,
	widthRem,
	isCollapsed,
	minRem,
	maxRem,
	collapsedRem,
	defaultRem,
	onDraggingChange,
	onCollapsedPreview,
	onCommit,
}: SidebarResizeHandleProps) {
	const [dragging, setDragging] = React.useState(false);
	const drag = React.useRef<{ startX: number; startRem: number; rem: number; collapsed: boolean } | null>(null);
	const frame = React.useRef<number | null>(null);

	// Halfway between the rail and the minimum width decides which one a release settles on.
	const collapsePoint = (collapsedRem + minRem) / 2;

	const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		const startRem = isCollapsed ? collapsedRem : widthRem;
		drag.current = { startX: event.clientX, startRem, rem: startRem, collapsed: isCollapsed };
		setDragging(true);
		onDraggingChange(true);
	};

	const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const state = drag.current;
		if (!state) return;
		state.rem = Math.min(maxRem, Math.max(collapsedRem, state.startRem + (event.clientX - state.startX) / REM));
		const collapsed = state.rem < collapsePoint;
		if (collapsed !== state.collapsed) {
			state.collapsed = collapsed;
			onCollapsedPreview(collapsed, state.rem);
		}
		if (frame.current === null) {
			frame.current = requestAnimationFrame(() => {
				frame.current = null;
				if (targetRef.current && drag.current) targetRef.current.style.width = `${drag.current.rem}rem`;
			});
		}
	};

	const finish = (event: React.PointerEvent<HTMLDivElement>) => {
		const state = drag.current;
		if (!state) return;
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId);
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		frame.current = null;
		drag.current = null;
		setDragging(false);
		onDraggingChange(false);
		const settled = state.collapsed ? collapsedRem : Math.max(minRem, state.rem);
		onCommit({ widthRem: state.collapsed ? widthRem : settled, isCollapsed: state.collapsed });
		// The drag wrote the width inline; ease it from where the pointer left it to where it settles.
		// React may not rewrite it (e.g. still collapsed), so set it here, a frame later, once the
		// width transition is back on.
		const target = targetRef.current;
		requestAnimationFrame(() => {
			if (target) target.style.width = `${settled}rem`;
		});
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const current = isCollapsed ? collapsedRem : widthRem;
		let next: number | null = null;
		if (event.key === "ArrowLeft") {
			// At the minimum, one more step left collapses to the rail.
			if (!isCollapsed && widthRem <= minRem) {
				event.preventDefault();
				onCommit({ widthRem, isCollapsed: true });
				return;
			}
			next = current - KEY_STEP_REM;
		} else if (event.key === "ArrowRight") next = isCollapsed ? minRem : current + KEY_STEP_REM;
		else if (event.key === "Home") next = minRem;
		else if (event.key === "End") next = maxRem;
		if (next === null || (isCollapsed && event.key === "ArrowLeft")) return;
		event.preventDefault();
		onCommit({ widthRem: Math.min(maxRem, Math.max(minRem, next)), isCollapsed: false });
	};

	return (
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize sidebar"
			aria-valuemin={Math.round(collapsedRem * REM)}
			aria-valuemax={Math.round(maxRem * REM)}
			aria-valuenow={Math.round((isCollapsed ? collapsedRem : widthRem) * REM)}
			tabIndex={0}
			data-dragging={dragging}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={finish}
			onPointerCancel={finish}
			onDoubleClick={() => onCommit({ widthRem: defaultRem, isCollapsed: false })}
			onKeyDown={handleKeyDown}
			className="group/resize absolute -right-2 top-0 z-10 flex h-full w-4 cursor-col-resize touch-none justify-center outline-none"
		>
			{/* The sidebar's edge line. On hover it darkens and thickens (after a beat, so passing
			    the pointer over it doesn't flicker), which with the resize cursor says "drag me". */}
			<span
				className={cn(
					"h-full w-px bg-border/60 transition-[width,background-color] duration-150",
					"group-hover/resize:w-0.5 group-hover/resize:bg-primary/30 group-hover/resize:delay-150",
					"group-focus-visible/resize:w-0.5 group-focus-visible/resize:bg-ring",
					dragging && "w-0.5 bg-primary/45 delay-0"
				)}
				aria-hidden
			/>
			{/* A small grip in the middle of the edge, as in VS Code: faint at rest, darker under the
			    pointer, so the edge reads as something you can drag. */}
			<span
				className={cn(
					"absolute top-1/2 flex -translate-y-1/2 flex-col gap-[3px] rounded-full bg-background px-[3px] py-1 transition-opacity duration-150",
					"opacity-60 group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100",
					dragging && "opacity-100"
				)}
				aria-hidden
			>
				{[0, 1, 2].map((dot) => (
					<span
						key={dot}
						className={cn(
							"h-[3px] w-[3px] rounded-full bg-muted-foreground/60 transition-colors",
							"group-hover/resize:bg-primary/60",
							dragging && "bg-primary/70"
						)}
					/>
				))}
			</span>
		</div>
	);
}
