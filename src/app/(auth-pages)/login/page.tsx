'use client';

import type React from 'react';
import { login } from '@/app/(auth-pages)/login/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useState } from 'react';

export default function Page() {
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsLoading(true);
		setError(null);

		const formData = new FormData(e.currentTarget);
		const result = await login(formData);

		if (result?.error) {
			setError(result.error);
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader>
							<CardTitle className="text-2xl">Login</CardTitle>
							<CardDescription>Enter your email below to login to your account</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleLogin}>
								<div className="flex flex-col gap-6">
									<div className="grid gap-2">
										<Label htmlFor="email">Email</Label>
										<Input id="email" name="email" type="email" placeholder="m@example.com" required />
									</div>
									<div className="grid gap-2">
										<Label htmlFor="password">Password</Label>
										<Input id="password" name="password" type="password" required />
									</div>
									{error && <p className="text-sm text-red-500">{error}</p>}
									<Button type="submit" className="w-full" disabled={isLoading}>
										{isLoading ? 'Logging in...' : 'Login'}
									</Button>
								</div>
								<div className="mt-4 text-center text-sm">
									Don&apos;t have an account?{' '}
									<Link
										href="/signup"
										className="underline underline-offset-4"
										onClick={() => console.log('Link clicked')}
									>
										Sign up
									</Link>
								</div>
							</form>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
