"use client";

import * as React from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	Bold,
	Italic,
	Strikethrough,
	Code,
	Heading1,
	Heading2,
	Heading3,
	List,
	ListOrdered,
	Quote,
	Minus,
	Undo,
	Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MinimalTiptapProps {
	content?: string;
	onChange?: (content: string) => void;
	placeholder?: string;
	editable?: boolean;
	className?: string;
	editorContentClassName?: string;
}

interface ToolbarButtonProps extends React.ComponentPropsWithoutRef<typeof Button> {
	icon: React.ElementType;
	tooltip: string;
}

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
	({ icon: Icon, tooltip, className, ...props }, ref) => (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button ref={ref} variant="ghost" size="sm" type="button" className={cn(className)} {...props}>
					<Icon className="h-4 w-4" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				<p>{tooltip}</p>
			</TooltipContent>
		</Tooltip>
	)
);
ToolbarButton.displayName = "ToolbarButton";

interface ToolbarToggleProps extends React.ComponentPropsWithoutRef<typeof Toggle> {
	icon: React.ElementType;
	tooltip: string;
}

const ToolbarToggle = React.forwardRef<HTMLButtonElement, ToolbarToggleProps>(
	({ icon: Icon, tooltip, className, ...props }, ref) => (
		<Tooltip>
			<TooltipTrigger asChild>
				<Toggle ref={ref} size="sm" type="button" className={cn(className)} {...props}>
					<Icon className="h-4 w-4" />
				</Toggle>
			</TooltipTrigger>
			<TooltipContent>
				<p>{tooltip}</p>
			</TooltipContent>
		</Tooltip>
	)
);
ToolbarToggle.displayName = "ToolbarToggle";

function MinimalTiptap({
	content = "",
	onChange,
	placeholder = "Start typing...",
	editable = true,
	className,
	editorContentClassName,
}: MinimalTiptapProps) {
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
				class: cn(
					"prose-base dark:prose-invert max-w-none focus:outline-none",
					"min-h-[12rem] p-4 border-0 text-primary",
					editorContentClassName
				),
			},
		},
	});

	// Subscribe to editor state changes to trigger re-renders
	// This ensures that isMarkActive checks are always accurate
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
			<div className="border-b border-border p-2 flex flex-wrap items-center gap-1">
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

				<ToolbarToggle
					icon={Strikethrough}
					tooltip="Strikethrough"
					pressed={isMarkActive("strike")}
					onPressedChange={() => editor.chain().focus().toggleStrike().run()}
					disabled={!editor.can().chain().focus().toggleStrike().run()}
				/>

				<ToolbarToggle
					icon={Code}
					tooltip="Code"
					pressed={isMarkActive("code")}
					onPressedChange={() => editor.chain().focus().toggleCode().run()}
					disabled={!editor.can().chain().focus().toggleCode().run()}
				/>

				<Separator orientation="vertical" className="h-6" />

				<ToolbarToggle
					icon={Heading1}
					tooltip="Heading 1"
					pressed={editor.isActive("heading", { level: 1 })}
					onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
				/>

				<ToolbarToggle
					icon={Heading2}
					tooltip="Heading 2"
					pressed={editor.isActive("heading", { level: 2 })}
					onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
				/>

				<ToolbarToggle
					icon={Heading3}
					tooltip="Heading 3"
					pressed={editor.isActive("heading", { level: 3 })}
					onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
				/>

				<Separator orientation="vertical" className="h-6" />

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

				<ToolbarToggle
					icon={Quote}
					tooltip="Blockquote"
					pressed={editor.isActive("blockquote")}
					onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
				/>

				<Separator orientation="vertical" className="h-6" />

				<ToolbarButton
					icon={Minus}
					tooltip="Horizontal Rule"
					onClick={() => editor.chain().focus().setHorizontalRule().run()}
				/>

				<Separator orientation="vertical" className="h-6" />

				<ToolbarButton
					icon={Undo}
					tooltip="Undo"
					onClick={() => editor.chain().focus().undo().run()}
					disabled={!editor.can().chain().focus().undo().run()}
				/>

				<ToolbarButton
					icon={Redo}
					tooltip="Redo"
					onClick={() => editor.chain().focus().redo().run()}
					disabled={!editor.can().chain().focus().redo().run()}
				/>
			</div>

			<EditorContent editor={editor} placeholder={placeholder} />
		</div>
	);
}

export { MinimalTiptap, type MinimalTiptapProps };
