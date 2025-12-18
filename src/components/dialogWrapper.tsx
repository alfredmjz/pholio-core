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

interface TriggerBasedDialogProps {
	title?: React.ReactNode;
	description?: React.ReactNode;
	trigger: React.ReactNode;
	content: React.ReactNode;
	buttonLabel?: React.ReactNode;
	formId?: string;
	showSubmit?: boolean;
}

/**
 * Trigger-based dialog - opens when trigger is clicked
 * Use for simple dialogs triggered by a button click
 */
export function TriggerBasedDialog({
	title,
	description,
	trigger,
	content,
	buttonLabel = "Submit",
	formId,
	showSubmit = true,
}: TriggerBasedDialogProps) {
	return (
		<Dialog>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				{content}
				{showSubmit && (
					<DialogFooter className="justify-end">
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
}

/**
 * Controlled-based dialog - state managed externally via open/onOpenChange props
 * Use for dialogs that need programmatic control (e.g., forms, multi-step flows)
 */
export function ControlBasedDialog({
	open,
	onOpenChange,
	title,
	description,
	children,
	className = "sm:max-w-md",
}: ControlBasedDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={className}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description && <DialogDescription>{description}</DialogDescription>}
				</DialogHeader>
				{children}
			</DialogContent>
		</Dialog>
	);
}
