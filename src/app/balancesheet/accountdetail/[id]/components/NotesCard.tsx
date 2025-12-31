"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MinimalTiptap } from "@/components/ui/shadcn-io/minimal-tiptap";
import { updateAccount } from "../../../actions";
import type { AccountWithType } from "../../../types";

import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface NotesCardProps {
	account: AccountWithType;
	onAccountUpdated: (account: AccountWithType) => void;
}

export function NotesCard({ account, onAccountUpdated }: NotesCardProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [notes, setNotes] = useState(account.notes || "");
	const [isSaving, setIsSaving] = useState(false);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			const result = await updateAccount(account.id, { notes });
			if (result) {
				toast.success("Notes updated");
				setIsEditing(false);
				setIsDialogOpen(false);
				onAccountUpdated({ ...account, notes });
			} else {
				toast.error("Update Failed", {
					description: "Failed to update notes. Please try again.",
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
			toast.error("Error", {
				description: errorMessage,
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancel = () => {
		setNotes(account.notes || "");
		setIsEditing(false);
		setIsDialogOpen(false);
	};

	return (
		<>
			<Card className="p-4">
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-sm font-semibold text-primary">Notes</h3>
					{!isEditing ? (
						<Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={() => setIsEditing(true)}>
							Edit Note
						</Button>
					) : (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 text-muted-foreground hover:text-primary"
							onClick={() => setIsDialogOpen(true)}
							title="Expand editor"
						>
							<Maximize2 className="h-4 w-4" />
						</Button>
					)}
				</div>

				{isEditing ? (
					<div className="flex flex-col gap-3 relative animate-in fade-in-0 zoom-in-95 duration-200">
						<div className="relative">
							<MinimalTiptap content={notes} onChange={setNotes} placeholder="Add some notes about this account..." />
						</div>
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

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent className="max-w-3xl h-[80vh] flex flex-col">
					<DialogHeader>
						<DialogTitle>Edit Notes</DialogTitle>
					</DialogHeader>
					<div className="flex-1 overflow-y-auto min-h-0 py-4">
						<MinimalTiptap
							content={notes}
							onChange={setNotes}
							placeholder="Add some notes about this account..."
							editorContentClassName="h-full min-h-[300px]"
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
						<Button onClick={handleSave} disabled={isSaving}>
							{isSaving ? "Saving..." : "Save Changes"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
