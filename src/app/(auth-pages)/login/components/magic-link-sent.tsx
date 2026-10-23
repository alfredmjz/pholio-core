"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, RotateCw } from "lucide-react";

import { sendMagicLink } from "@/app/(auth-pages)/login/actions";
import { reloadOutdatedPage } from "@/app/(auth-pages)/login/outdated-page";
import { formatCountdown } from "@/lib/countdown";

interface MagicLinkSentProps {
	email: string;
	/** Seconds until the server allows another link, from the send that just succeeded. */
	retryAfterSeconds: number;
	onBack: () => void;
}

/**
 * "Check your inbox": resend the same link once the server allows it, or go back to the form.
 * The countdown is only a display of the server's `retryAfterSeconds`; the server enforces the
 * limits, and a refused resend replaces the countdown with the server's real wait.
 */
export function MagicLinkSent({ email, retryAfterSeconds, onBack }: MagicLinkSentProps) {
	const [resendAt, setResendAt] = useState(() => Date.now() + retryAfterSeconds * 1000);
	const [now, setNow] = useState(() => Date.now());
	const [isResending, setIsResending] = useState(false);
	const [limitMessage, setLimitMessage] = useState<string | null>(null);

	const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
	const isWaiting = secondsLeft > 0;

	useEffect(() => {
		if (!isWaiting) return;
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, [isWaiting]);

	const handleResend = async () => {
		if (isResending || isWaiting) return;
		setIsResending(true);

		const formData = new FormData();
		formData.set("email", email);

		try {
			const result = await sendMagicLink(formData);
			if (!result) {
				reloadOutdatedPage(email);
				return;
			}
			if ("error" in result) {
				if (result.retryAfterSeconds !== undefined) {
					setResendAt(Date.now() + result.retryAfterSeconds * 1000);
					setLimitMessage(result.error);
				} else {
					toast.error("Could not send the link", { description: result.error });
				}
				return;
			}
			setResendAt(Date.now() + result.retryAfterSeconds * 1000);
			setLimitMessage(null);
			toast.success("New link sent", { description: `Use the newest email sent to ${email}.` });
		} catch (err) {
			toast.error("Could not send the link", {
				description: err instanceof Error ? err.message : "An unexpected error occurred",
			});
		} finally {
			setNow(Date.now());
			setIsResending(false);
		}
	};

	return (
		<div>
			<div role="status" aria-live="polite">
				<div className="login-seal" aria-hidden>
					<Check className="h-[18px] w-[18px]" strokeWidth={1.7} />
					<span>Sent</span>
				</div>
				<h2 className="login-sheet-heading">Check your inbox.</h2>
				<p className="login-sent-copy mt-3">
					We sent a one-time sign-in link to <span className="login-sent-email">{email}</span>.
				</p>
				<p className="login-sent-copy mt-2">
					The link works once. If it hasn&apos;t arrived, check spam or send a new one.
				</p>
			</div>

			<button
				type="button"
				onClick={handleResend}
				disabled={isResending || isWaiting}
				aria-busy={isResending}
				className="login-demo login-resend mt-6"
			>
				<RotateCw className="h-4 w-4" aria-hidden />
				{isResending ? "Sending a new link…" : isWaiting ? `Resend in ${formatCountdown(secondsLeft)}` : "Resend link"}
			</button>
			{limitMessage && (
				<p role="alert" className="login-error">
					{limitMessage}
				</p>
			)}

			<div className="login-sheet-foot">
				<button type="button" onClick={onBack} className="login-again login-back">
					<ArrowLeft className="h-3.5 w-3.5" aria-hidden />
					Back
				</button>
				<span>The link expires once it&apos;s used.</span>
			</div>
		</div>
	);
}
