"use client";

import { MinimalTiptap } from "@/components/ui/shadcn-io/minimal-tiptap";
import type { AccountWithType } from "../../types";

interface AccountNotesProps {
	account: AccountWithType;
	isEditing: boolean;
	notes: string;
	onNotesChange: (notes: string) => void;
}

/**
 * Notes section with view and edit mode using TipTap editor.
 */
export function AccountNotes({ account, isEditing, notes, onNotesChange }: AccountNotesProps) {
	// Only show if there are notes or in edit mode
	if (!account.notes && !isEditing) {
		return null;
	}

	return (
		<div className="p-4 bg-muted/30 rounded-lg">
			<span className="text-xs font-medium text-primary uppercase tracking-wider block mb-2">Notes</span>
			{isEditing ? (
				<MinimalTiptap content={notes} onChange={onNotesChange} placeholder="Add some notes about this account..." />
			) : (
				<div
					className="text-primary prose prose-sm dark:prose-invert max-w-none"
					dangerouslySetInnerHTML={{ __html: account.notes || "" }}
				/>
			)}
		</div>
	);
}
