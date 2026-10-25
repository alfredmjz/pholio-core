import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { needsOnboarding, safeNextPath } from "@/lib/onboarding";
import { OnboardingForm } from "./onboarding-form";

export const metadata = {
	title: "Welcome | Pholio",
};

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
	const { profile } = await requireAuth();
	const next = safeNextPath((await searchParams).next);
	if (!needsOnboarding(profile)) redirect(next);

	return <OnboardingForm next={next} />;
}
