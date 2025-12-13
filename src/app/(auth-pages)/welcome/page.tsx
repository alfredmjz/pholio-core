"use client";

import { Suspense } from "react";
import { WelcomeCelebration } from "@/components/welcome-celebration";

export default function WelcomePage() {
	return (
		<Suspense fallback={<div className="min-h-screen bg-background" />}>
			<WelcomeCelebration forceOpen={true} redirectUrl="/dashboard" />
		</Suspense>
	);
}
