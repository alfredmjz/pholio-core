"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export function MfaCard() {
	const [isEnabled, setIsEnabled] = useState(false);
	const [isOpen, setIsOpen] = useState(false);

	const handleToggle = (checked: boolean) => {
		if (checked) {
			setIsOpen(true);
		} else {
			setIsEnabled(false);
		}
	};

	const handleEnable = () => {
		setIsEnabled(true);
		setIsOpen(false);
	};

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h3 className="text-lg font-medium">Two-Factor Authentication</h3>
				<p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<div className="flex flex-col gap-1">
						<Label htmlFor="mfa-toggle" className="font-medium">
							Authenticator App
						</Label>
						<span className="text-xs text-muted-foreground">
							Use an app like Google Authenticator or Authy to generate verification codes.
						</span>
					</div>
					<Switch id="mfa-toggle" checked={isEnabled} onCheckedChange={handleToggle} />
				</div>

				{isEnabled ? (
					<div className="rounded-md bg-success-muted p-3 border border-success/30 flex items-start gap-3">
						<ShieldCheck className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
						<div>
							<p className="text-sm font-medium text-success-foreground">2FA is enabled</p>
							<p className="text-xs text-muted-foreground mt-1">
								Your account is protected. You'll need to enter a code from your authenticator app when you sign in.
							</p>
						</div>
					</div>
				) : (
					<div className="rounded-md bg-secondary/50 p-3 border border-border flex items-start gap-3">
						<ShieldAlert className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
						<div>
							<p className="text-sm font-medium text-foreground">2FA is disabled</p>
							<p className="text-xs text-muted-foreground mt-1">
								We recommend enabling 2FA to prevent unauthorized access to your account.
							</p>
						</div>
					</div>
				)}

				<Dialog open={isOpen} onOpenChange={setIsOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Set up Two-Factor Authentication</DialogTitle>
							<DialogDescription>Scan the QR code below with your authenticator app to enable 2FA.</DialogDescription>
						</DialogHeader>
						<div className="flex flex-col items-center justify-center py-6 gap-4">
							<div className="w-48 h-48 bg-white border border-border rounded flex items-center justify-center">
								{/* Placeholder QR Code */}
								<Smartphone className="w-16 h-16 text-muted-foreground/30" />
							</div>
							<div className="text-center space-y-2">
								<p className="text-sm font-medium">Scanning not working?</p>
								<div className="flex items-center gap-2 p-2 bg-secondary rounded border border-border">
									<code className="text-xs font-mono">ABCD EFGH IJKL MNOP</code>
									<Button variant="ghost" size="icon" className="h-6 w-6">
										<span className="sr-only">Copy</span>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
											className="w-3 h-3"
										>
											<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
											<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
										</svg>
									</Button>
								</div>
							</div>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={() => setIsOpen(false)}>
								Cancel
							</Button>
							<Button onClick={handleEnable}>Verify & Enable</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
