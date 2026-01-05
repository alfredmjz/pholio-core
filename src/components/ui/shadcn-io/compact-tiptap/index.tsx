"use client";

import * as React from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompactTiptapProps {
	content?: string;
	onChange?: (content: string) => void;
	placeholder?: string;
	editable?: boolean;
	className?: string;
}

interface ToolbarToggleProps extends React.ComponentPropsWithoutRef<typeof Toggle> {
	icon: React.ElementType;
	tooltip: string;
}

const ToolbarToggle = React.forwardRef<HTMLButtonElement, ToolbarToggleProps>(
	({ icon: Icon, tooltip, className, ...props }, ref) => (
		<Tooltip>
			<TooltipTrigger asChild>
				<Toggle ref={ref} size="sm" type="button" className={cn("h-7 w-7 p-0", className)} {...props}>
					<Icon className="h-3.5 w-3.5" />
				</Toggle>
			</TooltipTrigger>
			<TooltipContent>
				<p>{tooltip}</p>
			</TooltipContent>
		</Tooltip>
	)
);
ToolbarToggle.displayName = "ToolbarToggle";

/**
 * A compact version of the TipTap editor with a minimal toolbar.
 * Designed for use in dialogs and smaller UI contexts.
 */
function CompactTiptap({
	content = "",
	onChange,
	placeholder = "Start typing...",
	editable = true,
	className,
}: CompactTiptapProps) {
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				bulletList: {
					keepMarks: true,
					keepAttributes: false,
				},
				orderedList: {
					keepMarks: true,
					keepAttributes: false,
				},
				heading: false, // Disable headings for compact version
				codeBlock: false, // Disable code blocks for compact version
				blockquote: false, // Disable blockquotes for compact version
				horizontalRule: false, // Disable horizontal rule for compact version
			}),
		],
		content,
		editable,
		immediatelyRender: false,
		onUpdate: ({ editor }) => {
			onChange?.(editor.getHTML());
		},
		editorProps: {
			attributes: {
				class: cn("prose-sm dark:prose-invert max-w-none focus:outline-none", "min-h-[6rem] p-3 border-0 text-primary"),
			},
		},
	});

	// Subscribe to editor state changes to trigger re-renders
	useEditorState({
		editor,
		selector: (ctx) => ctx.editor?.state,
	});

	if (!editor) {
		return null;
	}

	// Helper to check if a mark is active OR stored (queued to be applied on next character)
	const isMarkActive = (markName: string) => {
		if (editor.isActive(markName)) return true;
		const storedMarks = editor.state.storedMarks;
		if (storedMarks) {
			return storedMarks.some((mark) => mark.type.name === markName);
		}
		return false;
	};

	return (
		<div className={cn("border border-border rounded-lg overflow-hidden", className)}>
			<div className="border-b border-border px-2 py-1.5 flex items-center gap-0.5 bg-muted/30">
				<ToolbarToggle
					icon={Bold}
					tooltip="Bold"
					pressed={isMarkActive("bold")}
					onPressedChange={() => editor.chain().focus().toggleBold().run()}
					disabled={!editor.can().chain().focus().toggleBold().run()}
				/>

				<ToolbarToggle
					icon={Italic}
					tooltip="Italic"
					pressed={isMarkActive("italic")}
					onPressedChange={() => editor.chain().focus().toggleItalic().run()}
					disabled={!editor.can().chain().focus().toggleItalic().run()}
				/>

				<div className="w-px h-4 bg-border mx-1" />

				<ToolbarToggle
					icon={List}
					tooltip="Bullet List"
					pressed={editor.isActive("bulletList")}
					onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
				/>

				<ToolbarToggle
					icon={ListOrdered}
					tooltip="Ordered List"
					pressed={editor.isActive("orderedList")}
					onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
				/>
			</div>

			<EditorContent editor={editor} placeholder={placeholder} />
		</div>
	);
}

export { CompactTiptap, type CompactTiptapProps };
