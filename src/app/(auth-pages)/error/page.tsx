import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; reason?: string }> }) {
	const params = await searchParams;
	const isLinkError = params?.reason === "link";

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader>
							<CardTitle className="type-h2">
								{isLinkError ? "This sign-in link didn't work" : "Sorry, something went wrong."}
							</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							{isLinkError ? (
								<p className="type-body-sm text-muted-foreground">
									It may have expired or already been used. Request a new link and open the newest email.
								</p>
							) : params?.error ? (
								<p className="type-body-sm text-muted-foreground">Code error: {params.error}</p>
							) : (
								<p className="type-body-sm text-muted-foreground">An unspecified error occurred.</p>
							)}
							<Button asChild>
								<Link href="/login">Back to sign in</Link>
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
