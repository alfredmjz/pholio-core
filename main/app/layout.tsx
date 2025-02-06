import React from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<title>My App</title>
			</head>
			<body>
				<header>
					<nav>{/* Navigation items */}</nav>
				</header>
				<main>{children}</main>
				<footer>{/* Footer content */}</footer>
			</body>
		</html>
	);
}
