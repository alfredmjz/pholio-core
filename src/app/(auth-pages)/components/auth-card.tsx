import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface AuthCardProps {
	title: string;
	description: string;
	children: React.ReactNode;
	className?: string;
}

export function AuthCard({ title, description, children, className }: AuthCardProps) {
	return (
		<Card className={cn("relative overflow-visible border-none mt-8", className)}>
			<div className="absolute -top-9 left-1/2 -translate-x-1/2 p-2">
				<Image src="/pholio-icon.svg" alt="Pholio" width={48} height={48} />
			</div>
			<CardHeader className="pt-10 pb-4">
				<h1 className="text-2xl font-semibold tracking-tight text-primary text-center">{title}</h1>
				<p className="text-sm muted-text-primary text-center">{description}</p>
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}
