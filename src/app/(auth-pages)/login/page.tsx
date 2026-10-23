"use client";

import "@/styles/login.css";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { sendMagicLink, startDemo } from "@/app/(auth-pages)/login/actions";
import { MagicLinkSent } from "@/app/(auth-pages)/login/components/magic-link-sent";
import { reloadOutdatedPage, takePendingEmail } from "@/app/(auth-pages)/login/outdated-page";
import { useDemoStore } from "@/lib/demo-store";
import { LedgerField } from "@/components/common/ledger-field";

const NET_WORTH = 248910;

const THREAD_PATH = "M 24 0 L 24 27 C 2 41 46 67 24 81 C 2 95 46 121 24 135 C 2 149 46 175 24 189";

const ACCOUNTS = [
	{ name: "Chequing", value: "4,210" },
	{ name: "Savings", value: "18,400" },
	{ name: "Investments", value: "96,300" },
];

export default function Page() {
	const router = useRouter();
	const netWorthRef = useRef<HTMLSpanElement>(null);
	const emailInputRef = useRef<HTMLInputElement>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isDemoLoading, setIsDemoLoading] = useState(false);
	const [sent, setSent] = useState<{ email: string; retryAfterSeconds: number } | null>(null);
	// Kept after going Back so the form opens with the address already filled in.
	const [lastEmail, setLastEmail] = useState("");
	const [fieldErrors, setFieldErrors] = useState<{ email?: string }>({});

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	useEffect(() => {
		const pendingEmail = takePendingEmail();
		if (pendingEmail && emailInputRef.current) {
			emailInputRef.current.value = pendingEmail;
			setLastEmail(pendingEmail);
		}
	}, []);

	useEffect(() => {
		const element = netWorthRef.current;
		if (!element) return;

		const formatter = new Intl.NumberFormat("en-US");
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

		if (reduceMotion.matches) {
			element.textContent = formatter.format(NET_WORTH);
			return;
		}

		let frame = 0;
		const start = performance.now() + 2300;
		const duration = 1200;

		const tick = (now: number) => {
			const progress = Math.max(0, Math.min(1, (now - start) / duration));
			const eased = 1 - Math.pow(1 - progress, 3);
			element.textContent = formatter.format(Math.round(NET_WORTH * eased));
			if (progress < 1) frame = requestAnimationFrame(tick);
		};

		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, []);

	const validate = (email: string): boolean => {
		if (!email) {
			setFieldErrors({ email: "Enter your email to get a link." });
			return false;
		}
		if (!emailRegex.test(email)) {
			setFieldErrors({ email: "That email address doesn't look right." });
			return false;
		}
		setFieldErrors({});
		return true;
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (isLoading) return;

		const formData = new FormData(e.currentTarget);
		const email = (formData.get("email") as string).trim().toLowerCase();

		if (!validate(email)) return;

		setIsLoading(true);
		try {
			const result = await sendMagicLink(formData);
			if (!result) {
				reloadOutdatedPage(email);
				return;
			}
			if ("error" in result) {
				toast.error("Could not send the link", { description: result.error });
				setIsLoading(false);
				return;
			}
			setLastEmail(email);
			setSent({ email, retryAfterSeconds: result.retryAfterSeconds });
			setIsLoading(false);
		} catch (err) {
			toast.error("Could not send the link", {
				description: err instanceof Error ? err.message : "An unexpected error occurred",
			});
			setIsLoading(false);
		}
	};

	const handleTryDemo = async () => {
		if (isDemoLoading) return;
		setIsDemoLoading(true);
		useDemoStore.getState().reset();

		const result = await startDemo();
		if (result?.error) {
			toast.error("Could not start the demo", { description: result.error });
			setIsDemoLoading(false);
			return;
		}

		router.push("/dashboard");
	};

	return (
		<div className="login-page theme-paper relative isolate min-h-dvh w-full overflow-x-hidden">
			<LedgerField className="login-field-canvas" />
			<div className="login-paper-edge" aria-hidden />
			<div className="login-paper-grain" aria-hidden />
			<div className="login-page-frame" aria-hidden />

			<div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1320px] flex-col px-6 lg:px-10">
				<header className="login-header flex items-center justify-between py-6 lg:py-8">
					<Link
						href="/"
						className="flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background"
						aria-label="Pholio home"
					>
						<Image src="/pholio-icon.svg" alt="" width={26} height={26} priority />
						<span className="login-wordmark">Pholio</span>
					</Link>
					<span className="login-tagline hidden sm:block">A calmer way to see your money.</span>
				</header>

				<div className="grid flex-1 grid-cols-1 items-center gap-8 pb-6 lg:grid-cols-12 lg:gap-16 lg:pb-14">
					{/* Desktop only: below lg the sign-in sheet is the whole page. */}
					<section className="hidden lg:col-span-7 lg:block">
						<h1 className="login-headline">
							<span className="login-headline-mask">
								<span className="login-headline-line">Every account,</span>
							</span>
							<span className="login-headline-mask">
								<span className="login-headline-line login-headline-light" style={{ animationDelay: "110ms" }}>
									one unbroken line.
								</span>
							</span>
						</h1>

						<p className="login-lede mt-5">
							Balances, debts, and budgets, threaded together. No spreadsheets, no guesswork.
						</p>

						<div className="login-ledger mt-10" aria-hidden>
							<div className="login-ledger-head">
								<span className="login-ledger-note">Three accounts, one thread</span>
							</div>

							<div className="login-ledger-rows">
								<svg viewBox="0 0 48 216" preserveAspectRatio="none" className="login-thread" aria-hidden>
									<path
										d={THREAD_PATH}
										pathLength={1}
										className="login-thread-path login-thread-shadow"
										vectorEffect="non-scaling-stroke"
									/>
									<path
										d={THREAD_PATH}
										pathLength={1}
										className="login-thread-path"
										vectorEffect="non-scaling-stroke"
									/>
								</svg>

								{ACCOUNTS.map((account, index) => (
									<div
										key={account.name}
										className="login-ledger-row"
										style={{ animationDelay: `${1 + index * 0.4}s` }}
									>
										<span className="login-ledger-hole" />
										<span className="login-ledger-name">{account.name}</span>
										<span className="login-ledger-value">${account.value}</span>
									</div>
								))}

								<div className="login-ledger-row login-ledger-total" style={{ animationDelay: "2.2s" }}>
									<span className="login-ledger-hole login-ledger-hole-live" />
									<span className="login-ledger-name">Net worth</span>
									<span className="login-ledger-value login-ledger-total-value">
										<span>$</span>
										<span ref={netWorthRef}>0</span>
									</span>
								</div>
							</div>
						</div>
					</section>

					<section className="flex justify-center lg:col-span-5 lg:justify-end">
						<div className="w-full max-w-[460px]">
							<div className="login-sheet">
								<div className="login-sheet-body">
									<div className="login-sheet-status">
										<span className="login-sheet-status-dot" aria-hidden />
										<span>Sign in</span>
									</div>

									{sent ? (
										<MagicLinkSent
											email={sent.email}
											retryAfterSeconds={sent.retryAfterSeconds}
											onBack={() => setSent(null)}
										/>
									) : (
										<>
											<h2 className="login-sheet-heading">Welcome back.</h2>
											<p className="login-sheet-copy mt-2">
												No password to remember. We&apos;ll email you a one-time sign-in link.
											</p>

											<form onSubmit={handleSubmit} noValidate className="mt-6">
												<label htmlFor="email" className="login-label">
													Email
												</label>
												<div className="login-field">
													<input
														id="email"
														name="email"
														type="email"
														autoComplete="email"
														required
														placeholder="you@example.com"
														ref={emailInputRef}
														defaultValue={lastEmail}
														className="login-input"
														aria-invalid={Boolean(fieldErrors.email)}
														aria-describedby={fieldErrors.email ? "email-error" : undefined}
														onChange={() => {
															if (fieldErrors.email) setFieldErrors({});
														}}
													/>
													<span className="login-field-line" aria-hidden />
												</div>
												{fieldErrors.email && (
													<p id="email-error" role="alert" className="login-error">
														{fieldErrors.email}
													</p>
												)}
												<button type="submit" disabled={isLoading} aria-busy={isLoading} className="login-submit mt-6">
													{isLoading ? "Sending link…" : "Email me a link"}
												</button>
											</form>

											<div className="login-divider">or</div>

											<button type="button" onClick={handleTryDemo} disabled={isDemoLoading} className="login-demo">
												<Sparkles className="h-4 w-4" />
												{isDemoLoading ? "Opening the demo…" : "Try the demo"}
											</button>
											<p className="login-demo-note">Sample data. Nothing is saved.</p>

											<div className="login-sheet-foot">
												<span>New here? The same link creates your account.</span>
											</div>
										</>
									)}
								</div>
							</div>
						</div>
					</section>
				</div>

				<footer className="login-footer">
					<span>© 2026 Pholio</span>
				</footer>
			</div>
		</div>
	);
}
