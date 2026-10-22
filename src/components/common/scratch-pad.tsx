"use client";

import { useEffect, useState, type ComponentType } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading1, Heading2, Italic, List, ListOrdered, Quote, Redo2, Strikethrough, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNotesEmpty, notesToHtml } from "@/lib/notes";

interface ScratchPadProps {
	/** The notes as editor HTML; older plain-text notes are accepted too. */
	value: string;
	onChange?: (html: string) => void;
	/** Read-only shows the notes without a cursor or toolbar. */
	editable?: boolean;
	placeholder?: string;
	/** Ruled lines shown before the writing needs more. */
	minLines?: number;
	/** "focus": the toolbar slides in while writing (a card); "always": it stays (a dialog). */
	toolbar?: "focus" | "always";
	id?: string;
	"aria-label"?: string;
	autoFocus?: boolean;
	className?: string;
}

interface ToolProps {
	icon: ComponentType<{ className?: string }>;
	label: string;
	active?: boolean;
	disabled?: boolean;
	onRun: () => void;
}

function Tool({ icon: Icon, label, active, disabled, onRun }: ToolProps) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			aria-pressed={active}
			disabled={disabled}
			// Keep the editor focused (and the selection intact) while clicking a tool.
			onMouseDown={(event) => event.preventDefault()}
			onClick={onRun}
			className={cn(
				"flex h-7 w-7 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35",
				active
					? "bg-primary text-primary-foreground"
					: "text-muted-foreground hover:bg-primary/[0.06] hover:text-primary"
			)}
		>
			<Icon className="h-3.5 w-3.5" />
		</button>
	);
}

function Toolbar({ editor }: { editor: Editor }) {
	const state = useEditorState({
		editor,
		selector: ({ editor: e }) => ({
			h1: e.isActive("heading", { level: 1 }),
			h2: e.isActive("heading", { level: 2 }),
			bold: e.isActive("bold"),
			italic: e.isActive("italic"),
			strike: e.isActive("strike"),
			bullets: e.isActive("bulletList"),
			numbers: e.isActive("orderedList"),
			quote: e.isActive("blockquote"),
			canUndo: e.can().undo(),
			canRedo: e.can().redo(),
		}),
	});
	const run = (fn: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => () =>
		fn(editor.chain().focus()).run();

	return (
		<div
			role="toolbar"
			aria-label="Formatting"
			className="inline-flex flex-wrap items-center gap-0.5 rounded-full bg-primary/[0.04] p-0.5"
		>
			<Tool icon={Heading1} label="Heading" active={state.h1} onRun={run((c) => c.toggleHeading({ level: 1 }))} />
			<Tool icon={Heading2} label="Subheading" active={state.h2} onRun={run((c) => c.toggleHeading({ level: 2 }))} />
			<span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
			<Tool icon={Bold} label="Bold" active={state.bold} onRun={run((c) => c.toggleBold())} />
			<Tool icon={Italic} label="Italic" active={state.italic} onRun={run((c) => c.toggleItalic())} />
			<Tool icon={Strikethrough} label="Strikethrough" active={state.strike} onRun={run((c) => c.toggleStrike())} />
			<span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
			<Tool icon={List} label="Bullets" active={state.bullets} onRun={run((c) => c.toggleBulletList())} />
			<Tool icon={ListOrdered} label="Numbering" active={state.numbers} onRun={run((c) => c.toggleOrderedList())} />
			<Tool icon={Quote} label="Quote" active={state.quote} onRun={run((c) => c.toggleBlockquote())} />
			<span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
			<Tool icon={Undo2} label="Undo" disabled={!state.canUndo} onRun={run((c) => c.undo())} />
			<Tool icon={Redo2} label="Redo" disabled={!state.canRedo} onRun={run((c) => c.redo())} />
		</div>
	);
}

/**
 * A paper scratch pad for account notes: handwriting on faint ruled lines, with headings,
 * bold/italic, bullets, numbering and quotes. No box around it; it sits on whatever sheet holds it.
 */
export function ScratchPad({
	value,
	onChange,
	editable = true,
	placeholder = "Jot anything here…",
	minLines = 4,
	toolbar = "focus",
	id,
	"aria-label": ariaLabel,
	autoFocus,
	className,
}: ScratchPadProps) {
	// Tracked from the editor's own events: a state subscription made before the editor exists
	// never picks it up, which left the placeholder over real notes.
	const [isEmpty, setIsEmpty] = useState(() => isNotesEmpty(value));

	const editor = useEditor({
		// Headings, marks, lists, quotes and history; code and rules would break the ruled rhythm.
		extensions: [
			StarterKit.configure({ heading: { levels: [1, 2] }, code: false, codeBlock: false, horizontalRule: false }),
		],
		content: notesToHtml(value),
		editable,
		autofocus: autoFocus ? "end" : false,
		immediatelyRender: false,
		onCreate: ({ editor: e }) => setIsEmpty(e.isEmpty),
		onUpdate: ({ editor: e }) => {
			setIsEmpty(e.isEmpty);
			onChange?.(e.getHTML());
		},
		editorProps: {
			attributes: {
				class: "scratch-pad-content",
				"aria-multiline": "true",
				...(id ? { id } : {}),
				...(ariaLabel ? { "aria-label": ariaLabel } : {}),
			},
		},
	});

	// Follow the value when it changes from outside (e.g. discarding edits), without echoing back.
	useEffect(() => {
		if (!editor) return;
		const next = notesToHtml(value);
		if (next !== editor.getHTML() && !(next === "" && editor.isEmpty)) {
			editor.commands.setContent(next, { emitUpdate: false });
			setIsEmpty(editor.isEmpty);
		}
	}, [editor, value]);

	useEffect(() => {
		editor?.setEditable(editable);
	}, [editor, editable]);

	return (
		<div className={cn("scratch-pad group/pad", className)} style={{ ["--pad-min-lines" as string]: minLines }}>
			{editable && editor && (
				<div
					className={cn(
						"grid transition-[grid-template-rows,opacity] duration-200",
						toolbar === "always"
							? "grid-rows-[1fr]"
							: "grid-rows-[0fr] opacity-0 group-focus-within/pad:grid-rows-[1fr] group-focus-within/pad:opacity-100"
					)}
				>
					<div className="overflow-hidden">
						<div className="pb-3">
							<Toolbar editor={editor} />
						</div>
					</div>
				</div>
			)}
			<div className="relative">
				{isEmpty && (
					<p className="scratch-pad-placeholder" aria-hidden>
						{placeholder}
					</p>
				)}
				<EditorContent editor={editor} />
			</div>
		</div>
	);
}
