'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';

export function SideBarComponent() {
	const [sidebarWidth, setSidebarWidth] = React.useState<number>(20); // Default width in rem

	React.useEffect(() => {
		const savedWidth = localStorage.getItem('sidebarWidth');
		if (savedWidth) {
			setSidebarWidth(parseFloat(savedWidth)); // Set width from local storage if available
		}
	}, []);

	const handleMouseDown = (e: React.MouseEvent) => {
		document.body.classList.add('select-none'); // Prevent text selection during drag

		const startX = e.clientX;
		const startWidth = sidebarWidth;

		const handleMouseMove = (moveEvent: MouseEvent) => {
			// Calculate the maximum width in rem (33% of the viewport width)
			const maxWidth = (window.innerWidth * 0.25) / 16; // Convert 33% of viewport width to rem
			// Calculate new width in rem
			const newWidth = Math.min(
				maxWidth, // Ensure it doesn't exceed 33% of the viewport width
				Math.max(12.5, startWidth + (moveEvent.clientX - startX) / 16) // Minimum width: 12.5rem
			);
			setSidebarWidth(newWidth);
		};

		const handleMouseUp = () => {
			document.body.classList.remove('select-none'); // Re-enable text selection
			localStorage.setItem('sidebarWidth', sidebarWidth.toString());

			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

	return (
		<div
			className="relative w-full h-full bg-secondary"
			style={{ width: `${sidebarWidth}rem` }} // Dynamically set the width
		>
			<NavigationMenu orientation="vertical">
				<NavigationMenuList className="w-full flex flex-col justify-start items-start gap-2 p-4">
					<NavigationMenuItem>
						<NavigationMenuTrigger className="w-full h-fit flex gap-4 text-primary truncate ">
							<div className="w-4 h-4 rounded-md bg-black"></div>
							<span>User A</span>
						</NavigationMenuTrigger>
						<NavigationMenuContent className="!w-[18.75rem] bg-secondary-highlight rounded-md">
							<ul>
								<ListItem href="/docs" title="Introduction">
									Re-usable components built using Radix UI and Tailwind CSS.
								</ListItem>
								<ListItem href="/docs/installation" title="Installation">
									How to install dependencies and structure your app.
								</ListItem>
								<ListItem href="/docs/primitives/typography" title="Typography">
									Styles for headings, paragraphs, lists...etc
								</ListItem>
							</ul>
						</NavigationMenuContent>
					</NavigationMenuItem>

					<NavigationMenuItem>
						<NavigationMenuLink className={navigationMenuTriggerStyle()}>Documentation</NavigationMenuLink>
					</NavigationMenuItem>
				</NavigationMenuList>
			</NavigationMenu>
			<div
				className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-secondary-highlight hover:bg-secondary-muted"
				onMouseDown={handleMouseDown}
			></div>
		</div>
	);
}

const ListItem = React.forwardRef<React.ComponentRef<'a'>, React.ComponentPropsWithoutRef<'a'>>(
	({ className, title, children, ...props }, ref) => {
		return (
			<li>
				<NavigationMenuLink asChild>
					<a
						ref={ref}
						className={cn(
							'flex flex-col justify-center select-none rounded-md m-1 p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
							className
						)}
						{...props}
					>
						<div className="text-sm font-medium leading-none">{title}</div>
						<p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{children}</p>
					</a>
				</NavigationMenuLink>
			</li>
		);
	}
);
ListItem.displayName = 'ListItem';
