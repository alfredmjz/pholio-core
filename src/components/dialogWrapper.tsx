import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { handleEnterSubmit } from "@/lib/enter-submit";

interface ControlBasedDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: React.ReactNode;
	description?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
	showCloseButton?: boolean;
	/** When provided, pressing Enter (outside text fields) triggers the primary action. */
	onEnterSubmit?: () => void;
	/** Intercept the Escape key (call preventDefault to stop the dialog closing). */
	onEscapeKeyDown?: (event: KeyboardEvent) => void;
}

export function ControlBasedDialog({
	open,
	onOpenChange,
	title,
	description,
	children,
	className = "sm:max-w-md",
	showCloseButton = true,
	onEnterSubmit,
	onEscapeKeyDown,
}: ControlBasedDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={className}
				showCloseButton={showCloseButton}
				onEscapeKeyDown={onEscapeKeyDown}
				onKeyDown={onEnterSubmit ? (event) => handleEnterSubmit(event, onEnterSubmit) : undefined}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description && <DialogDescription>{description}</DialogDescription>}
				</DialogHeader>
				{children}
			</DialogContent>
		</Dialog>
	);
}
