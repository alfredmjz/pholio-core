"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MinimalTiptap } from "@/components/ui/shadcn-io/minimal-tiptap";
import { updateAccount } from "../../../actions";
import type { AccountWithType } from "../../../types";

interface NotesCardProps {
	account: AccountWithType;
	onAccountUpdated: (account: AccountWithType) => void;
}

export function NotesCard({ account, onAccountUpdated }: NotesCardProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [notes, setNotes] = useState(account.notes || "");
	const [isSaving, setIsSaving] = useState(false);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			const result = await updateAccount(account.id, { notes });
			if (result) {
				toast.success("Notes updated");
				setIsEditing(false);
				onAccountUpdated({ ...account, notes });
			} else {
				toast.error("Failed to update notes");
			}
		} catch (error) {
			toast.error("An error occurred");
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancel = () => {
		setNotes(account.notes || "");
		setIsEditing(false);
	};

	return (
		<Card className="p-4">
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-semibold text-primary">Notes</h3>
				{!isEditing && (
					<Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={() => setIsEditing(true)}>
						Edit Note
					</Button>
				)}
			</div>

			{isEditing ? (
				<div className="flex flex-col gap-3">
					<MinimalTiptap content={notes} onChange={setNotes} placeholder="Add some notes about this account..." />
					<div className="flex items-center justify-end gap-2">
						<Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
							Cancel
						</Button>
						<Button size="sm" onClick={handleSave} disabled={isSaving}>
							{isSaving ? "Saving..." : "Save"}
						</Button>
					</div>
				</div>
			) : (
				<div className="text-sm text-primary">
					{account.notes ? (
						<div
							className="prose prose-sm dark:prose-invert max-w-none"
							dangerouslySetInnerHTML={{ __html: account.notes }}
						/>
					) : (
						<p className="italic">No notes yet</p>
					)}
				</div>
			)}
		</Card>
	);
}
