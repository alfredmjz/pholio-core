'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

import type { UserProfile } from '@/lib/getUserProfile';

interface SideBarComponentProps {
	userProfile: UserProfile | null;
}

const GUEST_NAMES = [
	'Wandering Traveler',
	'Mystery Guest',
	'Anonymous Visitor',
	'Curious Explorer',
	'Digital Nomad',
	'Silent Observer',
	'Phantom User',
	'Shadow Walker',
];

/**
 * Generates a random guest name from predefined list
 */
function getRandomGuestName(): string {
	return GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
}

/**
 * Gets initials from a name (e.g., "John Doe" -> "JD")
 */
function getInitials(name: string): string {
	return name
		.split(' ')
		.map((part) => part[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);
}

export function SideBarComponent({ userProfile }: SideBarComponentProps) {
	const [sidebarWidth, setSidebarWidth] = React.useState<number>(14); // Default width in rem
	const [minWidth, setMinWidth] = React.useState<number>(12.5); // Minimum width in rem
	const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);
	const [guestName] = React.useState<string>(() => getRandomGuestName());

	const contentRef = React.useRef<HTMLDivElement>(null);

	const displayName = userProfile?.full_name || guestName;
	const displayInitials = getInitials(displayName);

	React.useEffect(() => {
		const savedWidth = localStorage.getItem('sidebarWidth');
		const savedCollapsed = localStorage.getItem('sidebarCollapsed');

		if (savedWidth) {
			setSidebarWidth(parseFloat(savedWidth)); // Set width from local storage if available
		}
		if (savedCollapsed) {
			setIsCollapsed(savedCollapsed === 'true');
		}
	}, []);

	React.useEffect(() => {
		if (contentRef.current && !isCollapsed) {
			const timeoutId = setTimeout(() => {
				if (!contentRef.current) return;

				const navList = contentRef.current.querySelector('ul');
				if (navList) {
					// Get the natural scroll width (content width without wrapping)
					const totalWidthPx = navList.scrollWidth;
					// Convert to rem and round up
					const calculatedMinWidth = Math.ceil(totalWidthPx / 16);

					setMinWidth(Math.max(12.5, calculatedMinWidth));
				}
			}, 100);

			return () => clearTimeout(timeoutId);
		}
	}, [isCollapsed, displayName, userProfile]);

	const toggleCollapse = () => {
		const newCollapsed = !isCollapsed;
		setIsCollapsed(newCollapsed);
		localStorage.setItem('sidebarCollapsed', newCollapsed.toString());

		// When expanding, ensure width is at least the minimum width
		if (!newCollapsed && sidebarWidth < minWidth) {
			setSidebarWidth(minWidth);
			localStorage.setItem('sidebarWidth', minWidth.toString());
		}
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		if (isCollapsed) return; // Disable resizing when collapsed

		document.body.classList.add('select-none'); // Prevent text selection during drag

		const startX = e.clientX;
		const startWidth = sidebarWidth;

		const handleMouseMove = (moveEvent: MouseEvent) => {
			// Calculate the maximum width in rem (25% of the viewport width)
			const maxWidth = (window.innerWidth * 0.25) / 16; // Convert 25% of viewport width to rem
			// Calculate new width in rem using the dynamically calculated minimum width
			const newWidth = Math.min(
				maxWidth, // Ensure it doesn't exceed 25% of the viewport width
				Math.max(minWidth, startWidth + (moveEvent.clientX - startX) / 16) // Use calculated minimum width
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
			className="relative h-full bg-secondary flex-shrink-0 flex flex-col"
			style={{ width: isCollapsed ? '4rem' : `${sidebarWidth}rem` }}
		>
			{/* Header with Collapse/Expand Button */}
			<div className="flex items-center justify-start px-4 py-2">
				<button
					onClick={toggleCollapse}
					className="flex items-center justify-center w-8 h-8 rounded-md bg-secondary-highlight hover:bg-secondary-muted transition-colors shadow-sm"
					aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					{isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
				</button>
			</div>

			{/* Sidebar Content */}
			<div ref={contentRef} className={cn(isCollapsed && 'hidden')}>
				<NavigationMenu orientation="vertical">
					<NavigationMenuList className="w-full flex flex-col justify-start items-start gap-2">
						<NavigationMenuItem>
							<NavigationMenuTrigger className="w-full h-fit flex justify-start gap-4 text-primary truncate">
								{userProfile?.avatar_url ? (
									<img src={userProfile.avatar_url} alt={displayName} className="w-8 h-8 rounded-md object-cover" />
								) : (
									<div className="w-8 h-8 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
										{displayInitials}
									</div>
								)}
								<span className="truncate">{displayName}</span>
							</NavigationMenuTrigger>
							<NavigationMenuContent className="w-fit bg-secondary-highlight rounded-md ml-2">
								<ul className="flex flex-col gap-3 p-4 border-none min-w-[15rem]">
									<ListItem title="Profile">View and edit your profile settings.</ListItem>
									<ListItem title="Settings">Customize your preferences.</ListItem>
									<ListItem title="Help">Get help and documentation.</ListItem>
									<ListItem title="Sign Out">Log out of your account.</ListItem>
								</ul>
							</NavigationMenuContent>
						</NavigationMenuItem>

						<NavigationMenuItem>
							<NavigationMenuLink className={navigationMenuTriggerStyle()}>Documentation</NavigationMenuLink>
						</NavigationMenuItem>
					</NavigationMenuList>
				</NavigationMenu>
			</div>

			{/* Resize Handle */}
			{!isCollapsed && (
				<div
					className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-secondary-highlight hover:bg-secondary-muted transition-colors"
					onMouseDown={handleMouseDown}
				></div>
			)}
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
