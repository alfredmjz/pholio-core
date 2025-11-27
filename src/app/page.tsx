export default async function HomePage() {
	return (
		<div className="flex items-center justify-center h-full">
			<div className="text-center space-y-4">
				<h1 className="text-4xl font-bold">Welcome to Pholio</h1>
				<p className="text-lg text-muted-foreground">
					Your automated personal finance tracker
				</p>
			</div>
		</div>
	);
}
