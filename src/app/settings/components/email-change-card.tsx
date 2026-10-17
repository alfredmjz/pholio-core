"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { changeEmail } from "../actions";

interface EmailChangeCardProps {
	currentEmail: string;
}

export default function EmailChangeCard({ currentEmail }: EmailChangeCardProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [formData, setFormData] = useState({
		newEmail: "",
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const data = new FormData();
		data.append("newEmail", formData.newEmail);

		startTransition(async () => {
			const result = await changeEmail(data);

			if (result.error) {
				toast.error("Update Failed", {
					description: result.error,
				});
			} else {
				toast.success(result.message);
				setIsOpen(false);
				setFormData({
					newEmail: "",
				});
			}
		});
	};

	const handleCancel = () => {
		setFormData({
			newEmail: "",
		});
		setIsOpen(false);
	};

	return (
		<div className="flex flex-col gap-3">
			<div>
				<h3 className="text-sm font-medium">Sign-in email</h3>
				<p className="text-xs text-primary">
					Current email: <span className="font-medium text-success">{currentEmail}</span>
				</p>
				<p className="text-xs text-primary">
					One-time sign-in links are sent here. Changing it requires confirming the new address by email.
				</p>
			</div>
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogTrigger asChild>
					<Button variant="outline" className="w-fit">
						Change sign-in email
					</Button>
				</DialogTrigger>
				<DialogContent>
					<form onSubmit={handleSubmit}>
						<DialogHeader>
							<DialogTitle>Change sign-in email</DialogTitle>
							<DialogDescription>Enter the new address for your one-time sign-in links.</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label htmlFor="newEmail">New Email Address</Label>
								<Input
									id="newEmail"
									type="email"
									required
									placeholder="new.email@example.com"
									value={formData.newEmail}
									onChange={(e) => setFormData({ ...formData, newEmail: e.target.value })}
									disabled={isPending}
								/>
							</div>

							<div className="rounded-md bg-info-muted p-3 border border-info/30">
								<p className="text-xs text-info">
									After submitting, you'll receive a verification email at your new address. Click the link in that
									email to complete the change.
								</p>
							</div>
						</div>

						<DialogFooter>
							<Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
								Cancel
								<CancelShortcut />
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? "Sending..." : "Send Verification Email"}
								<SubmitShortcut />
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
