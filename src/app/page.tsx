import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function HomePage() {
	// Require authentication - automatically redirects to /login if not authenticated
	await requireAuth();

	// If authenticated, redirect to dashboard
	redirect('/dashboard');
}
