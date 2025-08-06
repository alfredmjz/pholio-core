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
}

export function DialogButton({ title, description, trigger, content, buttonLabel }: DialogButtonProps) {
	return (
		<Dialog>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				{content}
				<DialogFooter className="justify-end">
					<Button type="submit" form="entry-form">
						{buttonLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
