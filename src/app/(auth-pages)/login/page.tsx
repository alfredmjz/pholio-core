"use client";

import { login, loginAsGuest } from "@/app/(auth-pages)/login/actions";
import { AuthCard } from "@/app/(auth-pages)/components/auth-card";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/floating-label-input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";
import { useAuthForm } from "@/hooks/use-auth-form";

export default function Page() {
	const router = useRouter();
	const [isGuestLoading, setIsGuestLoading] = useState(false);

	const validate = (formData: FormData): string | null => {
		const email = formData.get("email") as string;
		const password = formData.get("password") as string;
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

		if (!email || !emailRegex.test(email)) {
			toast.error("Invalid Email", {
				description: "Please enter a valid email address.",
			});
			return "Invalid Email";
		}

		if (!password) {
			toast.error("Password Required", {
				description: "Please enter your password.",
			});
			return "Password Required";
		}
		return null;
	};

	const { handleSubmit, isLoading, error, setError, isMounted } = useAuthForm({
		action: login,
		validate,
		onSuccess: (result) => {
			// Check if this is first login - redirect with welcome param
			const redirectUrl = (result as { showWelcome?: boolean })?.showWelcome ? "/?welcome=true" : "/";
			router.push(redirectUrl);
			// Detect if navigation failed (still on login page after timeout)
			setTimeout(() => {
				if (window.location.pathname === "/login") {
					toast.error("Login Failed", {
						description: "Unable to complete login. Please try again.",
					});
				}
			}, 2000);
		},
	});

	const handleGuestLogin = async () => {
		if (!isMounted) return;
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
			console.error("[Guest Login Client] Error caught:", err);
			toast.error("Something went wrong", {
				description: "Please try again later.",
			});
			setIsGuestLoading(false);
		}
	};

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-[450px]">
				<div className="flex flex-col gap-6">
					<AuthCard
						title="Welcome to Pholio!"
						description="Enter your email below to log in"
						className="shadow-[0px_0px_25px_rgba(0,0,0,0.08)] bg-card backdrop-blur-sm"
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
								<div className="grid gap-2">
									<FloatingLabelInput
										id="password"
										name="password"
										type="password"
										label="Password"
										required
										className="border-border focus-visible:ring-offset-0 focus-visible:ring-ring bg-card/80"
									/>
									<div className="pl-1 flex justify-start">
										<Link href="/forgot-password" className="font-medium text-xs text-primary underline-animation">
											Forgot password?
										</Link>
									</div>
								</div>
								{error && (
									<div className="p-3 text-sm text-error bg-error/10 rounded-md border border-error/20">{error}</div>
								)}
								<div className="flex flex-col gap-3 pt-2">
									<Button type="submit" className="w-full h-10" disabled={isLoading || isGuestLoading || !isMounted}>
										{isLoading ? "Logging in..." : "Log in"}
									</Button>

									<div className="flex items-center gap-4 py-2">
										<span className="h-px flex-1 bg-border" />
										<span className="text-xs uppercase text-primary">Or</span>
										<span className="h-px flex-1 bg-border" />
									</div>

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
								Don't have an account?{" "}
								<Link href="/signup" className="font-medium text-primary underline-animation">
									Sign up
								</Link>
							</div>
						</form>
					</AuthCard>
				</div>
			</div>
		</div>
	);
}
