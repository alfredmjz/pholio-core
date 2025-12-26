"use client";

import * as React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Toggle } from "@/components/ui/toggle";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompactTiptapProps {
	content?: string;
	onChange?: (content: string) => void;
	placeholder?: string;
	editable?: boolean;
	className?: string;
}

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

	if (!editor) {
		return null;
	}

	return (
		<div className={cn("border rounded-lg overflow-hidden", className)}>
			<div className="border-b px-2 py-1.5 flex items-center gap-0.5 bg-muted/30">
				<Toggle
					size="sm"
					pressed={editor.isActive("bold")}
					onPressedChange={() => editor.chain().focus().toggleBold().run()}
					disabled={!editor.can().chain().focus().toggleBold().run()}
					className="h-7 w-7 p-0"
				>
					<Bold className="h-3.5 w-3.5" />
				</Toggle>

				<Toggle
					size="sm"
					pressed={editor.isActive("italic")}
					onPressedChange={() => editor.chain().focus().toggleItalic().run()}
					disabled={!editor.can().chain().focus().toggleItalic().run()}
					className="h-7 w-7 p-0"
				>
					<Italic className="h-3.5 w-3.5" />
				</Toggle>

				<div className="w-px h-4 bg-border mx-1" />

				<Toggle
					size="sm"
					pressed={editor.isActive("bulletList")}
					onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
					className="h-7 w-7 p-0"
				>
					<List className="h-3.5 w-3.5" />
				</Toggle>

				<Toggle
					size="sm"
					pressed={editor.isActive("orderedList")}
					onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
					className="h-7 w-7 p-0"
				>
					<ListOrdered className="h-3.5 w-3.5" />
				</Toggle>
			</div>

			<EditorContent editor={editor} placeholder={placeholder} />
		</div>
	);
}

export { CompactTiptap, type CompactTiptapProps };
