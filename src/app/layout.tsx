import React from 'react';
import '@/styles/globals.css';
import LayoutWrapper from '@/components/layoutWrapper';

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<title>Folio</title>
			</head>
			<body className="w-screen h-screen min-h-screen flex flex-row bg-primary">
				<LayoutWrapper>{children}</LayoutWrapper>
				<footer>{/* Footer content */}</footer>
			</body>
		</html>
	);
}
