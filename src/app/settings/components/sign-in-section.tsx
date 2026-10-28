"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeEmail } from "../actions";
import { SettingRow, SettingsSection } from "./settings-section";

export function SignInSection({ email }: { email: string }) {
	const [open, setOpen] = useState(false);
	const [newEmail, setNewEmail] = useState("");
	const [isPending, startTransition] = useTransition();

	const close = (next: boolean) => {
		setOpen(next);
		if (!next) setNewEmail("");
	};

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		const formData = new FormData();
		formData.append("newEmail", newEmail);
		startTransition(async () => {
			const result = await changeEmail(formData);
			if (result.error) {
				toast.error("Couldn't change your email", { description: result.error });
			} else {
				toast.success(result.message);
				close(false);
			}
		});
	};

	return (
		<SettingsSection id="sign-in" title="Sign-in">
			<SettingRow
				label="Sign-in email"
				description={
					<>
						Links go to <span className="text-primary">{email}</span>.
					</>
				}
			>
				<Button variant="outline" onClick={() => setOpen(true)} className="w-full row-wide:w-auto">
					Change email
				</Button>
			</SettingRow>

			<ControlBasedDialog
				open={open}
				onOpenChange={close}
				title="Change sign-in email"
				description="We'll email a link to the new address. The change happens once you open it."
			>
				<form onSubmit={submit} className="space-y-5">
					<div className="space-y-2">
						<Label htmlFor="newEmail">New email</Label>
						<Input
							id="newEmail"
							type="email"
							required
							autoComplete="email"
							placeholder="you@example.com"
							value={newEmail}
							onChange={(event) => setNewEmail(event.target.value)}
							disabled={isPending}
						/>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => close(false)} disabled={isPending}>
							Cancel
							<CancelShortcut />
						</Button>
						<Button type="submit" disabled={isPending || !newEmail.trim()}>
							{isPending ? "Sending..." : "Send link"}
							<SubmitShortcut />
						</Button>
					</DialogFooter>
				</form>
			</ControlBasedDialog>
		</SettingsSection>
	);
}
