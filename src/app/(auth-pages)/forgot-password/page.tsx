"use client";

import { forgotPassword } from "@/app/(auth-pages)/forgot-password/actions";
import { AuthCard } from "@/app/(auth-pages)/components/auth-card";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/floating-label-input";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthForm } from "@/hooks/use-auth-form";

export default function ForgotPasswordPage() {
	const validate = (formData: FormData): string | null => {
		const email = formData.get("email") as string;
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!email || !emailRegex.test(email)) {
			toast.error("Invalid Email", {
				description: "Please enter a valid email address.",
			});
			return "Invalid Email";
		}
		return null;
	};

	const { handleSubmit, isLoading, error, success, isMounted } = useAuthForm({
		action: forgotPassword,
		validate,
	});

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-[450px]">
				<div className="flex flex-col gap-6">
					<AuthCard
						title="Reset Password"
						description="Enter your email to receive a password reset link"
						className="shadow-xl bg-card"
					>
						<form onSubmit={handleSubmit} noValidate>
							<div className="flex flex-col gap-5">
								<div className="grid gap-2">
									<FloatingLabelInput
										id="email"
										name="email"
										type="email"
										label="Email"
										required
										className="border-border focus-visible:ring-offset-0 focus-visible:ring-ring bg-card/80"
									/>
								</div>
								{error && (
									<div className="p-3 text-sm text-error bg-error/10 rounded-md border border-error/20">{error}</div>
								)}
								{success && (
									<div className="p-3 text-sm text-green-600 bg-green-50 rounded-md border border-green-200">
										{success}
									</div>
								)}
								<div className="flex flex-col gap-3 pt-2">
									<Button
										type="submit"
										className="w-full h-10 bg-primary hover:bg-primary/90 text-primary shadow-sm font-medium transition-all"
										disabled={isLoading || !isMounted}
									>
										{isLoading ? "Sending link..." : "Send Reset Link"}
									</Button>
								</div>
							</div>
							<div className="mt-6 text-center text-sm text-primary">
								Remember your password?{" "}
								<Link href="/login" className="font-medium text-primary underline-animation">
									Log in
								</Link>
							</div>
						</form>
					</AuthCard>
				</div>
			</div>
		</div>
	);
}
