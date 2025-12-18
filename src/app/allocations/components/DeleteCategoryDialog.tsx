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
			title={
				<span className="flex items-center gap-2">
					<AlertTriangle className="h-5 w-5 text-error" />
					Delete Category
				</span>
			}
			className="sm:max-w-[425px]"
		>
			<div className="space-y-3">
				<p className="text-foreground">
					Are you sure you want to delete <span className="font-semibold">"{categoryName}"</span>?
				</p>
				{transactionCount > 0 && (
					<div className="rounded-md bg-warning/10 border border-warning/30 p-3">
						<p className="text-sm text-warning">
							This category has <span className="font-semibold">{transactionCount}</span>{" "}
							{transactionCount === 1 ? "transaction" : "transactions"} that will become uncategorized.
						</p>
					</div>
				)}
				<p className="text-sm text-muted-foreground">This action cannot be undone.</p>
			</div>

			<DialogFooter className="gap-2 sm:gap-0">
				<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
					Cancel
				</Button>
				<Button type="button" variant="destructive" onClick={handleConfirm} className="bg-error hover:bg-error/90">
					Delete Category
				</Button>
			</DialogFooter>
		</ControlBasedDialog>
	);
}
