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
		currentPassword: "",
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const data = new FormData();
		data.append("newEmail", formData.newEmail);
		data.append("currentPassword", formData.currentPassword);

		startTransition(async () => {
			const result = await changeEmail(data);

			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success(result.message);
				setIsOpen(false);
				setFormData({
					newEmail: "",
					currentPassword: "",
				});
			}
		});
	};

	const handleCancel = () => {
		setFormData({
			newEmail: "",
			currentPassword: "",
		});
		setIsOpen(false);
	};

	return (
		<div className="flex flex-col gap-3">
			<div>
				<h3 className="text-sm font-medium">Email Address</h3>
				<p className="text-xs text-muted-foreground">
					Current email: <span className="font-medium text-success">{currentEmail}</span>
				</p>
				<p className="text-xs text-muted-foreground">
					Update your email address. You'll need to verify the new address.
				</p>
			</div>
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogTrigger asChild>
					<Button variant="outline" className="w-fit">
						Change Email
					</Button>
				</DialogTrigger>
				<DialogContent>
					<form onSubmit={handleSubmit}>
						<DialogHeader>
							<DialogTitle>Change Email Address</DialogTitle>
							<DialogDescription>Enter your new email address and current password for verification</DialogDescription>
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

							<div className="space-y-2">
								<Label htmlFor="emailPassword">Current Password</Label>
								<Input
									id="emailPassword"
									type="password"
									required
									value={formData.currentPassword}
									onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
									disabled={isPending}
								/>
								<p className="text-xs text-muted-foreground">We need your password to verify this change</p>
							</div>

							<div className="rounded-md bg-info-muted p-3 border border-info/30">
								<p className="text-xs text-info-foreground">
									After submitting, you'll receive a verification email at your new address. Click the link in that
									email to complete the change.
								</p>
							</div>
						</div>

						<DialogFooter>
							<Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? "Sending..." : "Send Verification Email"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
