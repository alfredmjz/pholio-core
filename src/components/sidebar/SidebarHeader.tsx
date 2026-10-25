"use client";

import Link from "next/link";
import { PholioMark } from "@/components/common/pholio-mark";
import { cn } from "@/lib/utils";

interface SidebarHeaderProps {
	isCollapsed: boolean;
}

/**
 * The wordmark. The mark stays put at every width (centred in the collapsed rail) and the name
 * fades, so dragging the sidebar never reflows the header.
 */
export function SidebarHeader({ isCollapsed }: SidebarHeaderProps) {
	return (
		<div className="overflow-hidden pb-6 pt-5 pl-[1.3125rem]">
			<Link
				href="/dashboard"
				className="flex w-max items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label="Pholio dashboard"
			>
				<PholioMark size={22} />
				<span
					className={cn(
						"type-h4 whitespace-nowrap text-primary transition-opacity duration-150",
						isCollapsed && "opacity-0"
					)}
					aria-hidden
				>
					Pholio
				</span>
			</Link>
		</div>
	);
}
