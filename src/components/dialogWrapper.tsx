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
}

export function ControlBasedDialog({
	open,
	onOpenChange,
	title,
	description,
	children,
	className = "sm:max-w-md",
	showCloseButton = true,
}: ControlBasedDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={className} showCloseButton={showCloseButton}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description && <DialogDescription>{description}</DialogDescription>}
				</DialogHeader>
				{children}
			</DialogContent>
		</Dialog>
	);
}
