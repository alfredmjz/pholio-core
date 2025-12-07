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
import { ThemeToggle } from '@/components/theme-toggle';

import type { UserProfile } from '@/lib/getUserProfile';
import { signOut } from '@/app/(auth-pages)/login/actions';
import Link from 'next/link';

interface SideBarComponentProps {
	userProfile: UserProfile | null;
}

const SIDEBAR_DEFAULTS = {
	WIDTH: 14,
	MIN_WIDTH: 12.5,
	COLLAPSED_WIDTH: 4,
	MAX_WIDTH_PERCENTAGE: 0.25,
	REM_TO_PX: 16,
	MIN_WIDTH_CALC_DELAY: 100,
} as const;

function getInitials(name: string): string {
	return name
		.split(' ')
		.map((part) => part[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);
}

export function SideBarComponent({ userProfile }: SideBarComponentProps) {
	const [sidebarWidth, setSidebarWidth] = React.useState<number>(SIDEBAR_DEFAULTS.WIDTH);
	const [minWidth, setMinWidth] = React.useState<number>(SIDEBAR_DEFAULTS.WIDTH);
	const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);
	const [openMenuItem, setOpenMenuItem] = React.useState<string>('');

	const contentRef = React.useRef<HTMLDivElement>(null);
	const sidebarWidthRef = React.useRef<number>(SIDEBAR_DEFAULTS.WIDTH);

	// Determine display name: use full_name for registered users, guest_name for guests
	const displayName = userProfile?.full_name || userProfile?.guest_name || 'Guest User';
	const displayInitials = getInitials(displayName);

	// Auto-collapse sidebar on mobile/tablet screens
	React.useEffect(() => {
		const handleResize = () => {
			const isSmallScreen = window.innerWidth < 1024; // lg breakpoint
			if (isSmallScreen && !isCollapsed) {
				setIsCollapsed(true);
			}
		};

		// Check on mount
		handleResize();

		// Add resize listener
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [isCollapsed]);

	React.useEffect(() => {
		const savedWidth = localStorage.getItem('sidebarWidth');
		const savedCollapsed = localStorage.getItem('sidebarCollapsed');

		if (savedWidth) {
			const width = parseFloat(savedWidth);
			setSidebarWidth(width);
			sidebarWidthRef.current = width;
		}
		if (savedCollapsed && window.innerWidth >= 1024) {
			// Only apply saved collapsed state on desktop
			setIsCollapsed(savedCollapsed === 'true');
		}
	}, []);

	React.useEffect(() => {
		sidebarWidthRef.current = sidebarWidth;
	}, [sidebarWidth]);

	React.useEffect(() => {
		if (!openMenuItem) return;

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			const viewport = document.querySelector('[data-radix-navigation-menu-viewport]');

			const isInsideMenu = contentRef.current?.contains(target);
			const isInsideViewport = viewport?.contains(target);

			if (!isInsideMenu && !isInsideViewport) {
				setOpenMenuItem('');
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [openMenuItem]);

	React.useEffect(() => {
		if (!contentRef.current || isCollapsed) return;

		const timeoutId = setTimeout(() => {
			const navList = contentRef.current?.querySelector('ul');
			if (!navList) return;

			const totalWidthPx = navList.scrollWidth;
			const calculatedMinWidth = Math.ceil(totalWidthPx / SIDEBAR_DEFAULTS.REM_TO_PX);
			const finalMinWidth = Math.max(SIDEBAR_DEFAULTS.MIN_WIDTH, calculatedMinWidth);

			setMinWidth(finalMinWidth);

			if (sidebarWidth < finalMinWidth) {
				setSidebarWidth(finalMinWidth);
				localStorage.setItem('sidebarWidth', finalMinWidth.toString());
			}
		}, SIDEBAR_DEFAULTS.MIN_WIDTH_CALC_DELAY);

		return () => clearTimeout(timeoutId);
	}, [isCollapsed, displayName, userProfile, sidebarWidth]);

	const toggleCollapse = React.useCallback(() => {
		const newCollapsed = !isCollapsed;
		setIsCollapsed(newCollapsed);
		localStorage.setItem('sidebarCollapsed', newCollapsed.toString());

		if (!newCollapsed && sidebarWidth < minWidth) {
			setSidebarWidth(minWidth);
			localStorage.setItem('sidebarWidth', minWidth.toString());
		}
	}, [isCollapsed, sidebarWidth, minWidth]);

	const handleMouseDown = React.useCallback(
		(e: React.MouseEvent) => {
			if (isCollapsed) return;

			document.body.classList.add('select-none');

			const startX = e.clientX;
			const startWidth = sidebarWidth;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const maxWidth = (window.innerWidth * SIDEBAR_DEFAULTS.MAX_WIDTH_PERCENTAGE) / SIDEBAR_DEFAULTS.REM_TO_PX;
				const delta = (moveEvent.clientX - startX) / SIDEBAR_DEFAULTS.REM_TO_PX;
				const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
				setSidebarWidth(newWidth);
			};

			const handleMouseUp = () => {
				document.body.classList.remove('select-none');
				localStorage.setItem('sidebarWidth', sidebarWidthRef.current.toString());
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
			};

			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
		},
		[isCollapsed, sidebarWidth, minWidth]
	);

	const handleSignOut = React.useCallback(async () => {
		// Clear sidebar preferences
		localStorage.removeItem('sidebarWidth');
		localStorage.removeItem('sidebarCollapsed');

		// Sign out (works for both registered users and guests)
		await signOut();
	}, []);

	return (
		<div
			className="relative bg-secondary shrink-0 flex flex-col overflow-y-hidden h-screen"
			style={{ width: isCollapsed ? `${SIDEBAR_DEFAULTS.COLLAPSED_WIDTH}rem` : `${sidebarWidth}rem` }}
		>
			<div className="flex items-center justify-start px-4 py-2">
				<button
					onClick={toggleCollapse}
					className="flex items-center justify-center w-8 h-8 rounded-md bg-secondary hover:bg-secondary-hover transition-colors shadow-sm"
					aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					{isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
				</button>
			</div>
			<div className={cn('w-full flex flex-1 flex-col', isCollapsed && 'hidden')}>
				<NavigationMenu
					ref={contentRef}
					className="w-full flex-1"
					orientation="vertical"
					value={openMenuItem}
					onValueChange={setOpenMenuItem}
				>
					<NavigationMenuList className="w-full flex flex-col justify-start items-start gap-2">
						<NavigationMenuItem value="profile" className="w-full">
							<NavigationMenuTrigger className="w-full h-fit flex justify-start gap-4 text-primary overflow-hidden pr-2">
								{userProfile?.avatar_url ? (
									<img
										src={userProfile.avatar_url}
										alt={displayName}
										className="w-8 h-8 flex-shrink-0 rounded-md object-cover"
									/>
								) : (
									<div className="w-8 h-8 flex-shrink-0 rounded-md bg-gradient-to-br from-notion-purple-text-light to-notion-pink-text-light dark:from-notion-purple-text-dark dark:to-notion-pink-text-dark flex items-center justify-center text-background text-xs font-semibold">
										{displayInitials}
									</div>
								)}
								<span className="truncate min-w-0 flex-1">{displayName}</span>
							</NavigationMenuTrigger>
							<NavigationMenuContent className="w-fit bg-secondary rounded-md ml-2">
								<ul className="flex flex-col gap-3 p-4 border-none min-w-[15rem]">
									<ListItem href="/profile" title="Profile">
										Manage your account settings
									</ListItem>
									<ListItem title="Sign Out" onClick={handleSignOut}></ListItem>
								</ul>
							</NavigationMenuContent>
						</NavigationMenuItem>

						<NavigationMenuItem value="navigation-links" className="flex flex-col gap-2 w-full">
							<Link href="/dashboard" className={navigationMenuTriggerStyle()}>
								Dashboard
							</Link>

							<Link href="/allocations" className={navigationMenuTriggerStyle()}>
								Allocations
							</Link>
						</NavigationMenuItem>
					</NavigationMenuList>
				</NavigationMenu>

				{/* Theme Toggle at bottom */}
				<div className="px-4 py-4 mt-auto border-t border-secondary-border">
					<ThemeToggle />
				</div>
			</div>
			{!isCollapsed && (
				<div
					className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-secondary hover:bg-secondary-hover transition-colors"
					onMouseDown={handleMouseDown}
				/>
			)}
		</div>
	);
}

const ListItem = React.forwardRef<React.ComponentRef<'a'>, React.ComponentPropsWithoutRef<'a'> & { href?: string }>(
	({ className, title, children, href, ...props }, ref) => {
		const content = (
			<>
				<h1 className="text-sm font-medium leading-none">{title}</h1>
				<p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{children}</p>
			</>
		);

		const itemClassName = cn(
			'flex flex-col justify-center select-none rounded-md m-1 p-3 leading-none no-underline outline-none transition-colors hover:bg-primary-hover focus:bg-accent focus:text-accent-foreground cursor-pointer',
			className
		);

		return (
			<li>
				<NavigationMenuLink asChild>
					{href ? (
						<Link ref={ref} href={href} className={itemClassName} {...props}>
							{content}
						</Link>
					) : (
						<a ref={ref} className={itemClassName} {...props}>
							{content}
						</a>
					)}
				</NavigationMenuLink>
			</li>
		);
	}
);
ListItem.displayName = 'ListItem';
