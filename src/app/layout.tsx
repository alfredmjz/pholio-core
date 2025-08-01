import React from 'react';
import '@/styles/globals.css';
import { SideBarComponent } from '@/components/sidebar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<title>Folio</title>
			</head>
			<body className="w-screen h-screen min-h-screen flex flex-row bg-primary">
				<SideBarComponent />
				<main>{children}</main>
				<footer>{/* Footer content */}</footer>
			</body>
		</html>
	);
}
