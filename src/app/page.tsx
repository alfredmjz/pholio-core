import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	// Require authentication - automatically redirects to /login if not authenticated
	await requireAuth();

	const resolvedParams = await searchParams;
	const queryString = new URLSearchParams(
		Object.entries(resolvedParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : (value ?? "")])
	).toString();

	const destination = queryString ? `/dashboard?${queryString}` : "/dashboard";

	// If authenticated, redirect to dashboard
	redirect(destination);
}
