'use client';

import React from 'react';
import { SideBarComponent } from '@/components/sidebar';
import { usePathname } from 'next/navigation';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const isAuthPage = pathname.includes('/login') || pathname.includes('/signup');

	return (
		<>
			{!isAuthPage && <SideBarComponent />}
			<main className="min-h-screen w-full">{children}</main>
		</>
	);
}
