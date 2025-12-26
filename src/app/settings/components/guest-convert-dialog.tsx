"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GuestConvertDialogProps {
	children: React.ReactNode;
}

export function GuestConvertDialog({ children }: GuestConvertDialogProps) {
	const [open, setOpen] = React.useState(false);
	const [isLoading, setIsLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [success, setSuccess] = React.useState(false);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsLoading(true);
		setError(null);

		const formData = new FormData(e.currentTarget);
		const email = formData.get("email") as string;
		const password = formData.get("password") as string;
		const fullName = formData.get("fullName") as string;

		try {
			const response = await fetch("/api/auth/users/guest/convert", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email, password, fullName }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to upgrade account");
			}

			setSuccess(true);
			setTimeout(() => {
				window.location.reload();
			}, 2000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to upgrade account");
			setIsLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Create Your Account</DialogTitle>
					<DialogDescription>
						Save your progress by creating a permanent account. Your guest data will be preserved.
					</DialogDescription>
				</DialogHeader>

				{success ? (
					<div className="flex flex-col items-center justify-center py-6 text-center">
						<div className="mb-4 h-12 w-12 rounded-full bg-success-muted flex items-center justify-center">
							<svg
								className="h-6 w-6 text-success"
								fill="none"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<p className="text-lg font-semibold text-success">Account upgraded successfully!</p>
						<p className="text-sm text-primary mt-2">Refreshing page...</p>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="fullName">Full Name (Optional)</Label>
							<Input id="fullName" name="fullName" type="text" placeholder="John Doe" />
						</div>

						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input id="email" name="email" type="email" placeholder="you@example.com" required />
						</div>

						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input id="password" name="password" type="password" minLength={6} required />
							<p className="text-xs text-primary">Minimum 6 characters</p>
						</div>

						{error && (
							<div className="rounded-md bg-error-muted p-3">
								<p className="text-sm text-error">{error}</p>
							</div>
						)}

						<div className="flex justify-end gap-3 pt-4">
							<Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
								Cancel
							</Button>
							<Button type="submit" disabled={isLoading}>
								{isLoading ? "Creating Account..." : "Create Account"}
							</Button>
						</div>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
