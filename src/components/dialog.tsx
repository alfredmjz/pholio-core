import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';

interface DialogButtonProps {
	title?: React.ReactNode;
	description?: React.ReactNode;
	trigger: React.ReactNode;
	content: React.ReactNode;
	buttonLabel?: React.ReactNode;
	formId?: string;
	showSubmit?: boolean;
}

export function DialogButton({
	title,
	description,
	trigger,
	content,
	buttonLabel = 'Submit',
	formId,
	showSubmit = true,
}: DialogButtonProps) {
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
