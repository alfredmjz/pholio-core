"use client";

import { resetPassword } from "@/app/(auth-pages)/reset-password/actions";
import { AuthCard } from "@/app/(auth-pages)/components/auth-card";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/floating-label-input";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthForm } from "@/hooks/use-auth-form";

export default function ResetPasswordPage() {
	const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});

	const validate = (formData: FormData): string | null => {
		const password = formData.get("password") as string;
		const confirmPassword = formData.get("confirmPassword") as string;
		let hasError = false;
		const newErrors: typeof fieldErrors = {};

		if (!password || password.length < 8) {
			newErrors.password = "Password must be at least 8 characters long";
			hasError = true;
		}

		if (password !== confirmPassword) {
			newErrors.confirmPassword = "Passwords do not match";
			hasError = true;
		}

		setFieldErrors(newErrors);

		if (hasError) {
			toast.error("Please fill in all required fields", {
				description: "Check the form for displayed errors.",
			});
			return "Validation Failed";
		}

		return null;
	};

	const { handleSubmit, isLoading, error, isMounted } = useAuthForm({
		action: resetPassword,
		validate,
	});

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-[450px]">
				<div className="flex flex-col gap-6">
					<AuthCard
						title="New Password"
						description="Enter your new password below"
						className="shadow-[0px_0px_25px_rgba(0,0,0,0.08)] bg-card/80 backdrop-blur-sm"
					>
						<form onSubmit={handleSubmit} noValidate>
							<div className="flex flex-col gap-5">
								<div className="grid gap-2">
									<FloatingLabelInput
										id="password"
										name="password"
										type="password"
										label="Password"
										required
										className="border-border focus-visible:ring-offset-0 focus-visible:ring-ring bg-card/80"
										hasError={!!fieldErrors.password}
										onChange={() => {
											if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
										}}
									/>
									{fieldErrors.password && <p className="text-xs text-error">{fieldErrors.password}</p>}
								</div>
								<div className="grid gap-2">
									<FloatingLabelInput
										id="confirmPassword"
										name="confirmPassword"
										type="password"
										label="Confirm Password"
										required
										className="border-border focus-visible:ring-offset-0 focus-visible:ring-ring bg-card/80"
										hasError={!!fieldErrors.confirmPassword}
										onChange={() => {
											if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: undefined });
										}}
									/>
									{fieldErrors.confirmPassword && <p className="text-xs text-error">{fieldErrors.confirmPassword}</p>}
								</div>
								{error && (
									<div className="p-3 text-sm text-error bg-error/10 rounded-md border border-error/20">{error}</div>
								)}
								<div className="flex flex-col gap-3 pt-2">
									<Button
										type="submit"
										className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-medium transition-all"
										disabled={isLoading || !isMounted}
									>
										{isLoading ? "Resetting..." : "Reset Password"}
									</Button>
								</div>
							</div>
						</form>
					</AuthCard>
				</div>
			</div>
		</div>
	);
}
