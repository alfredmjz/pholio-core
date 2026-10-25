"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeleteConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	onConfirm: () => void;
	confirmLabel?: string;
	/**
	 * Text the person must type before the button works, for deletes that can't be undone.
	 * The dialog then stays open after confirming; the caller closes it once the delete is done.
	 */
	confirmText?: string;
	pending?: boolean;
	/** Warning for something that can be redone (starting over), error for what can't. */
	tone?: "error" | "warning";
}

export function DeleteConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	onConfirm,
	confirmLabel = "Delete",
	confirmText,
	pending = false,
	tone = "error",
}: DeleteConfirmDialogProps) {
	const [typed, setTyped] = useState("");
	useEffect(() => {
		if (!open) setTyped("");
	}, [open]);

	const confirmed = confirmText === undefined || typed.trim() === confirmText;

	return (
		<AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				{confirmText !== undefined && (
					<div className="space-y-2">
						<Label htmlFor="delete-confirm-text">
							Type <span className="font-semibold">{confirmText}</span> to confirm
						</Label>
						<Input
							id="delete-confirm-text"
							value={typed}
							onChange={(event) => setTyped(event.target.value)}
							autoComplete="off"
							autoCapitalize="characters"
							spellCheck={false}
							disabled={pending}
						/>
					</div>
				)}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={(event) => {
							if (confirmText !== undefined) event.preventDefault();
							if (confirmed) onConfirm();
						}}
						disabled={!confirmed || pending}
						className={
							tone === "warning"
								? "bg-warning text-warning-foreground hover:bg-warning/90"
								: "bg-error hover:bg-error/90"
						}
					>
						{pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
