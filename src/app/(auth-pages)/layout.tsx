export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<main className="light-theme w-screen h-screen flex items-center justify-center bg-secondary text-primary">
			{children}
		</main>
	);
}
