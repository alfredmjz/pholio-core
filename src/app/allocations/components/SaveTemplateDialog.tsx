"use client";

import { useState } from "react";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SaveTemplateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (name: string, description: string) => Promise<void>;
	isSaving?: boolean;
}

export function SaveTemplateDialog({ open, onOpenChange, onSave, isSaving = false }: SaveTemplateDialogProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;

		await onSave(name.trim(), description.trim());

		// Reset form if successful (or handled by parent)
		if (!isSaving) {
			setName("");
			setDescription("");
		}
	};

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) {
					setName("");
					setDescription("");
				}
				onOpenChange(isOpen);
			}}
			title="Save as Template"
			description="Save your current month's budget configuration to quickly reuse it in the future."
			className="sm:max-w-[425px]"
		>
			<form onSubmit={handleSubmit} className="space-y-4 py-4">
				<div className="space-y-2">
					<Label htmlFor="templateName" className="font-medium text-primary">
						Template Name <span className="text-destructive">*</span>
					</Label>
					<Input
						id="templateName"
						autoFocus
						placeholder="e.g. Standard Monthly Budget"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
						maxLength={100}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="templateDescription" className="font-medium text-primary">
						Description <span className="text-muted-foreground text-xs">(optional)</span>
					</Label>
					<Textarea
						id="templateDescription"
						placeholder="Briefly describe when to use this template..."
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className="resize-none"
						rows={3}
					/>
				</div>

				<div className="flex justify-end gap-3 pt-4">
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
						Cancel
					</Button>
					<Button type="submit" disabled={!name.trim() || isSaving}>
						{isSaving ? "Saving..." : "Save Template"}
					</Button>
				</div>
			</form>
		</ControlBasedDialog>
	);
}
