"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<AlertTriangle className="h-5 w-5 text-red-600" />
						Delete Category
					</DialogTitle>
					<DialogDescription asChild>
						<div className="space-y-3 pt-2">
							<p className="text-neutral-700">
								Are you sure you want to delete <span className="font-semibold">"{categoryName}"</span>?
							</p>
							{transactionCount > 0 && (
								<div className="rounded-md bg-amber-50 border border-amber-200 p-3">
									<p className="text-sm text-amber-900">
										This category has <span className="font-semibold">{transactionCount}</span>{" "}
										{transactionCount === 1 ? "transaction" : "transactions"} that will become
										uncategorized.
									</p>
								</div>
							)}
							<p className="text-sm text-neutral-600">
								This action cannot be undone.
							</p>
						</div>
					</DialogDescription>
				</DialogHeader>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={handleConfirm}
						className="bg-red-600 hover:bg-red-700"
					>
						Delete Category
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
