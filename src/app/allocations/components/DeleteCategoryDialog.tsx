"use client";

import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DeleteCategoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	categoryName: string;
	transactionCount?: number;
}

export function DeleteCategoryDialog({
	open,
	onOpenChange,
	onConfirm,
	categoryName,
	transactionCount = 0,
}: DeleteCategoryDialogProps) {
	const handleConfirm = () => {
		onConfirm();
		onOpenChange(false);
	};

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title={`Delete ${categoryName}?`}
			description="It's removed from this month's budget. This can't be undone."
			className="sm:max-w-md"
		>
			{transactionCount > 0 && (
				<p className="type-body-sm flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-muted p-3 text-warning">
					<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
					<span>
						Its {transactionCount} {transactionCount === 1 ? "transaction moves" : "transactions move"} to
						Uncategorized.
					</span>
				</p>
			)}

			<DialogFooter>
				<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
					Cancel
				</Button>
				<Button type="button" variant="destructive" onClick={handleConfirm}>
					Delete category
				</Button>
			</DialogFooter>
		</ControlBasedDialog>
	);
}
