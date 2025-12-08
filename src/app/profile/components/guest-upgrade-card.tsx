"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GuestConvertDialog } from "@/components/guest-convert-dialog";
import { CheckIcon, Target } from "lucide-react";

export default function GuestUpgradeCard() {
	return (
		<Card className="border-success/30 bg-success/5">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Target className="w-5 h-5 text-success" />
					Upgrade Your Account
				</CardTitle>
				<CardDescription>You're currently using a guest account</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">Create a permanent account to unlock all features:</p>

					<ul className="space-y-2">
						<li className="flex items-start gap-2 text-sm">
							<CheckIcon className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
							<span>Save your data permanently</span>
						</li>
						<li className="flex items-start gap-2 text-sm">
							<CheckIcon className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
							<span>Access from multiple devices</span>
						</li>
						<li className="flex items-start gap-2 text-sm">
							<CheckIcon className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
							<span>Connect financial institutions</span>
						</li>
						<li className="flex items-start gap-2 text-sm">
							<CheckIcon className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
							<span>Get personalized insights</span>
						</li>
					</ul>

					<GuestConvertDialog>
						<Button className="w-full bg-success hover:bg-success/90">Create Account</Button>
					</GuestConvertDialog>
				</div>
			</CardContent>
		</Card>
	);
}
