import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { handleEnterSubmit } from "@/lib/enter-submit";

interface TriggerBasedDialogProps {
	title?: React.ReactNode;
	description?: React.ReactNode;
	trigger: React.ReactNode;
	content: React.ReactNode;
	buttonLabel?: React.ReactNode;
	formId?: string;
	showSubmit?: boolean;
	showCloseButton?: boolean;
}

export function TriggerBasedDialog({
	title,
	description,
	trigger,
	content,
	buttonLabel = "Submit",
	formId,
	showSubmit = true,
	showCloseButton = true,
}: TriggerBasedDialogProps) {
	return (
		<Dialog>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-md" showCloseButton={showCloseButton}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description && <DialogDescription>{description}</DialogDescription>}
				</DialogHeader>
				{content}
				{showSubmit && (
					<DialogFooter>
						<Button type="submit" form={formId}>
							{buttonLabel}
						</Button>
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	);
}

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
