"use client";

import type React from "react";
import { loginAsGuest, signup } from "@/app/(auth-pages)/login/actions";
import { AuthCard } from "@/app/(auth-pages)/components/auth-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FloatingLabelInput } from "@/components/floating-label-input";
import { toast } from "sonner";
import { useAuthForm } from "@/hooks/use-auth-form";

export default function Page() {
	const router = useRouter();
	const [isGuestLoading, setIsGuestLoading] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<{
		fullName?: string;
		email?: string;
		password?: string;
		repeatPassword?: string;
	}>({});

	const validate = (formData: FormData): string | null => {
		const password = formData.get("password") as string;
		const repeatPassword = formData.get("repeatPassword") as string;
		const email = formData.get("email") as string;
		const fullName = formData.get("fullName") as string;
		const newErrors: typeof fieldErrors = {};
		let hasError = false;

		if (!fullName || fullName.trim().length < 2) {
			newErrors.fullName = "Full name must be at least 2 characters";
			hasError = true;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!email || !emailRegex.test(email)) {
			newErrors.email = "Please enter a valid email address";
			hasError = true;
		}

		if (!password || password.length < 8) {
			newErrors.password = "Password must be at least 8 characters long";
			hasError = true;
		}

		if (password !== repeatPassword) {
			newErrors.repeatPassword = "Passwords do not match";
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

	const { handleSubmit, isLoading, error, setError, isMounted } = useAuthForm({
		action: signup,
		validate,
		onSuccess: (result: any) => {
			if (result?.redirectUrl) {
				router.push(result.redirectUrl);
			}
		},
	});

	const handleGuestLogin = async () => {
		setIsGuestLoading(true);
		setError(null);

		try {
			const result = await loginAsGuest();

			if (result?.error) {
				setError(result.error);
				toast.error("Guest Login Failed", {
					description: result.error,
				});
				setIsGuestLoading(false);
			} else {
				router.push("/");
			}
		} catch (err) {
			console.error("[Signup Guest Login] Error caught:", err);
			toast.error("Something went wrong");
			setIsGuestLoading(false);
		}
	};

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-[450px]">
				<div className="flex flex-col gap-6">
					<AuthCard title="Join Pholio" description="Create a new account to get started" className="shadow-xl bg-card">
						<form onSubmit={handleSubmit} noValidate>
							<div className="flex flex-col gap-5">
								<div className="grid gap-2">
									<FloatingLabelInput
										id="fullName"
										name="fullName"
										type="text"
										label="Full Name"
										required
										className="border-border focus-visible:ring-offset-0 focus-visible:ring-ring bg-card/80"
										hasError={!!fieldErrors.fullName}
										onChange={() => {
											if (fieldErrors.fullName) setFieldErrors({ ...fieldErrors, fullName: undefined });
										}}
									/>
									{fieldErrors.fullName && <p className="text-xs text-error">{fieldErrors.fullName}</p>}
									<FloatingLabelInput
										id="email"
										name="email"
										type="email"
										label="Email"
										required
										className="border-border focus-visible:ring-offset-0 focus-visible:ring-ring bg-card/80"
										hasError={!!fieldErrors.email}
										onChange={() => {
											if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
										}}
									/>
									{fieldErrors.email && <p className="text-xs text-error">{fieldErrors.email}</p>}
								</div>
								<div className="flex flex-row gap-2">
									<div className="flex-1">
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
									<div className="flex-1">
										<FloatingLabelInput
											id="repeatPassword"
											name="repeatPassword"
											type="password"
											label="Repeat Password"
											required
											className="border-border focus-visible:ring-offset-0 focus-visible:ring-ring bg-card/80"
											hasError={!!fieldErrors.repeatPassword}
											onChange={() => {
												if (fieldErrors.repeatPassword) setFieldErrors({ ...fieldErrors, repeatPassword: undefined });
											}}
										/>
										{fieldErrors.repeatPassword && <p className="text-xs text-error">{fieldErrors.repeatPassword}</p>}
									</div>
								</div>

								{error && (
									<div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">{error}</div>
								)}

								<div className="flex flex-col gap-3 pt-2">
									<Button type="submit" className="w-full h-10" disabled={isLoading || !isMounted}>
										{isLoading ? "creating account..." : "Sign up"}
									</Button>

									<Button
										type="button"
										variant="outline"
										className="w-full h-10 text-xs"
										onClick={handleGuestLogin}
										disabled={isLoading || isGuestLoading || !isMounted}
									>
										{isGuestLoading ? "Creating session..." : "Continue as Guest"}
									</Button>
								</div>
							</div>
							<div className="mt-6 text-center text-sm text-primary">
								Already have an account?{" "}
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
