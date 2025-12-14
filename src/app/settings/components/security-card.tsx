"use client";

import PasswordChangeCard from "./password-change-card";
import EmailChangeCard from "./email-change-card";

interface SecurityCardProps {
	userEmail: string;
}

export default function SecurityCard({ userEmail }: SecurityCardProps) {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h3 className="text-lg font-medium">Credentials</h3>
				<p className="text-sm text-muted-foreground">Change your password or email address</p>
			</div>
			{/* Password Change Section */}
			<PasswordChangeCard />

			{/* Email Change Section */}
			<EmailChangeCard currentEmail={userEmail} />
		</div>
	);
}
