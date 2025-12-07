import { requireAuth } from '@/lib/auth';

export default async function HomePage() {
	// Require authentication - automatically redirects to /login if not authenticated
	const { profile } = await requireAuth();

	return (
		<div className="flex items-center justify-center h-full">
			<div className="text-center space-y-4">
				<h1 className="text-4xl font-bold">Welcome to Pholio</h1>
				<p className="text-lg text-muted-foreground">Your automated personal finance tracker</p>
				{profile.is_guest && (
					<p className="text-sm text-muted-foreground">You're using a guest account. Visit your profile to upgrade.</p>
				)}
			</div>
		</div>
	);
}
