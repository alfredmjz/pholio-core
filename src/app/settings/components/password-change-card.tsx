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
import { changePassword } from "../actions";

export default function PasswordChangeCard() {
	const [isOpen, setIsOpen] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [formData, setFormData] = useState({
		currentPassword: "",
		newPassword: "",
		confirmPassword: "",
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const data = new FormData();
		data.append("currentPassword", formData.currentPassword);
		data.append("newPassword", formData.newPassword);
		data.append("confirmPassword", formData.confirmPassword);

		startTransition(async () => {
			const result = await changePassword(data);

			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success(result.message);
				setIsOpen(false);
				setFormData({
					currentPassword: "",
					newPassword: "",
					confirmPassword: "",
				});
			}
		});
	};

	const handleCancel = () => {
		setFormData({
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		});
		setIsOpen(false);
	};

	return (
		<div className="flex flex-col gap-3">
			<div>
				<h3 className="text-sm font-medium">Password</h3>
				<p className="text-xs text-muted-foreground">Change your password to keep your account secure</p>
			</div>
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogTrigger asChild>
					<Button variant="outline" className="w-fit">
						Change Password
					</Button>
				</DialogTrigger>
				<DialogContent>
					<form onSubmit={handleSubmit}>
						<DialogHeader>
							<DialogTitle>Change Password</DialogTitle>
							<DialogDescription>Enter your current password and choose a new one</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label htmlFor="currentPassword">Current Password</Label>
								<Input
									id="currentPassword"
									type="password"
									required
									value={formData.currentPassword}
									onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
									disabled={isPending}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="newPassword">New Password</Label>
								<Input
									id="newPassword"
									type="password"
									required
									minLength={8}
									value={formData.newPassword}
									onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
									disabled={isPending}
								/>
								<p className="text-xs text-muted-foreground">Minimum 8 characters</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="confirmPassword">Confirm New Password</Label>
								<Input
									id="confirmPassword"
									type="password"
									required
									value={formData.confirmPassword}
									onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
									disabled={isPending}
								/>
							</div>
						</div>

						<DialogFooter>
							<Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? "Updating..." : "Update Password"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
