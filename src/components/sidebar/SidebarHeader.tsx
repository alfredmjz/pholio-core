"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarHeaderProps {
	isCollapsed: boolean;
	onToggleCollapse: () => void;
}

export function SidebarHeader({ isCollapsed, onToggleCollapse }: SidebarHeaderProps) {
	return (
		<div className="hidden lg:flex items-center justify-start px-4 py-2">
		<Button
			onClick={onToggleCollapse}
			variant="ghost"
			size="icon"
			className="flex items-center justify-center w-8 h-8 rounded-md bg-secondary hover:bg-accent hover:text-accent-foreground text-primary"
			aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
			title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
		>
				{isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
			</Button>
		</div>
	);
}
