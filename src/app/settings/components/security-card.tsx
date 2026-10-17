"use client";

import EmailChangeCard from "./email-change-card";

interface SecurityCardProps {
	userEmail: string;
}

export default function SecurityCard({ userEmail }: SecurityCardProps) {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h3 className="text-lg font-medium">Sign-in email</h3>
				<p className="text-sm text-primary">
					Pholio signs you in with one-time email links. Manage the address those links go to below.
				</p>
			</div>

			<EmailChangeCard currentEmail={userEmail} />
		</div>
	);
}
