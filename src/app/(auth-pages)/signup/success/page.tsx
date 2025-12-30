"use client";

import { resendConfirmationEmail } from "@/app/(auth-pages)/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { toast } from "sonner";

function SuccessContent() {
	const searchParams = useSearchParams();
	const email = searchParams.get("email");
	const [isResending, setIsResending] = useState(false);

	const handleResend = async () => {
		if (!email) {
			toast.error("Email not found. Please try logging in.");
			return;
		}

		setIsResending(true);
		try {
			const result = await resendConfirmationEmail(email);
			if (result?.error) {
				toast.error(result.error);
			} else {
				toast.success("Confirmation email resent!");
			}
		} catch (error) {
			toast.error("Failed to resend email");
		} finally {
			setIsResending(false);
		}
	};

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-[380px]">
				<Card className="border-none shadow-xl shadow-black/5 bg-white/80 backdrop-blur-sm">
					<CardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-4">
						<div className="p-3 rounded-full bg-blue-50 text-blue-600 mb-2">
							<Mail size={24} />
						</div>

						<div className="space-y-2">
							<h1 className="text-2xl font-semibold tracking-tight text-primary">Check your email</h1>
							<p className="text-[#787774] text-sm max-w-[280px] mx-auto leading-relaxed">
								We've sent a confirmation link{" "}
								{email ? <span className="font-medium text-primary">to {email}</span> : "to your inbox"}. Please click
								the link to confirm your account.
							</p>
						</div>

						<div className="w-full pt-4">
							<Button
								asChild
								variant="outline"
								className="w-full h-10 font-medium text-primary hover:bg-secondary bg-background border-border shadow-sm"
							>
								<Link href="/login">Back to Login</Link>
							</Button>
						</div>

						<p className="text-xs text-[#787774] mt-2">
							Did not receive the email?{" "}
							<button
								onClick={handleResend}
								disabled={isResending}
								className="font-medium text-primary after:bg-primary/50 disabled:opacity-50 disabled:cursor-not-allowed underline-animation"
							>
								{isResending ? "Sending..." : "Resend"}
							</button>
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

export default function Page() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<SuccessContent />
		</Suspense>
	);
}
