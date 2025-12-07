import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return <main className="w-screen h-screen flex items-center justify-center bg-primary">{children}</main>;
}
