"use client";

import "@/styles/login.css";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LedgerField } from "@/components/common/ledger-field";
import { PholioMark } from "@/components/common/pholio-mark";
import { cleanFullName, NAME_MAX_LENGTH } from "@/lib/onboarding";
import { completeOnboarding } from "./actions";

/** A new account's one setup step: the name Pholio greets them by. */
export function OnboardingForm({ next }: { next: string }) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [isSaving, startSaving] = useTransition();

	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		// Read from the form rather than state, so a name typed before the page finished loading counts.
		const cleaned = cleanFullName(new FormData(event.currentTarget).get("fullName"));
		if (cleaned.error !== undefined) {
			setError(cleaned.error);
			return;
		}
		startSaving(async () => {
			const result = await completeOnboarding(cleaned.name, Intl.DateTimeFormat().resolvedOptions().timeZone);
			if (!result.success) {
				setError(result.error ?? "Couldn't save that. Try again.");
				return;
			}
			router.replace(next);
			router.refresh();
		});
	};

	return (
		<div className="login-page theme-paper relative isolate min-h-dvh w-full overflow-x-hidden">
			<LedgerField className="login-field-canvas" />
			<div className="login-paper-edge" aria-hidden />
			<div className="login-paper-grain" aria-hidden />
			<div className="login-page-frame" aria-hidden />

			<div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1320px] flex-col px-6 lg:px-10">
				<header className="login-header flex items-center py-6 lg:py-8">
					<span className="flex items-center gap-2.5">
						<PholioMark size={26} className="login-mark" />
						<span className="login-wordmark">Pholio</span>
					</span>
				</header>

				<main className="flex flex-1 items-center justify-center pb-16">
					<div className="w-full max-w-[460px]">
						<div className="login-sheet">
							<div className="login-sheet-body">
								<div className="login-sheet-status">
									<span className="login-sheet-status-dot" aria-hidden />
									<span>Welcome to Pholio</span>
								</div>

								<h1 className="login-sheet-heading">What should we call you?</h1>
								<p className="login-sheet-copy mt-2">
									Pholio greets you by it. You can change it any time in Settings.
								</p>

								<form onSubmit={submit} noValidate className="mt-6">
									<label htmlFor="fullName" className="login-label">
										Your name
									</label>
									<div className="login-field">
										<input
											id="fullName"
											name="fullName"
											autoComplete="name"
											autoFocus
											maxLength={NAME_MAX_LENGTH}
											onChange={() => {
												if (error) setError(null);
											}}
											className="login-input"
											aria-invalid={Boolean(error)}
											aria-describedby={error ? "name-error" : undefined}
										/>
										<span className="login-field-line" aria-hidden />
									</div>
									{error && (
										<p id="name-error" role="alert" className="login-error">
											{error}
										</p>
									)}
									<button type="submit" disabled={isSaving} aria-busy={isSaving} className="login-submit mt-6">
										{isSaving ? "Saving…" : "Continue"}
									</button>
								</form>
							</div>
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}
