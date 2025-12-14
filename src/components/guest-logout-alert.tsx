"use client";

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

interface GuestLogoutAlertProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}

export function GuestLogoutAlert({ open, onOpenChange, onConfirm }: GuestLogoutAlertProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2 text-error">Warning: Data Loss</AlertDialogTitle>
					<AlertDialogDescription>
						You are currently logged in as a guest. If you log out now,{" "}
						<span className="font-bold text-foreground">all your data will be permanently deleted</span> and cannot be
						recovered. Create an account to save your data.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel className="bg-primary text-primary-foreground shadow hover:bg-primary/90">
						Go Back
					</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm} className="bg-error text-error-foreground hover:bg-error/90">
						Log Out Anyway
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
