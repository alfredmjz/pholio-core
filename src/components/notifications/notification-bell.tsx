"use client";

import { useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { sidebarItemClass } from "@/components/sidebar/SidebarNavigation";
import { markChangelogSeen, markNotificationsRead } from "@/lib/actions/notification-actions";
import type { AccountNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { NotificationPanel, type NotificationTab } from "./notification-panel";
import { useNotifications } from "./notifications-provider";

interface NotificationBellProps {
	/** A sidebar row with a label, or a round icon button for the phone top bar. */
	variant: "row" | "icon";
	isCollapsed?: boolean;
	side?: "right" | "bottom";
	align?: "start" | "end";
}

/** The bell and its panel. A dot shows while anything is unread; a tab counts as read once viewed and closed. */
export function NotificationBell({
	variant,
	isCollapsed = false,
	side = "right",
	align = "end",
}: NotificationBellProps) {
	const state = useNotifications();
	const [open, setOpen] = useState(false);
	const [tab, setTab] = useState<NotificationTab>("account");
	const viewed = useRef(new Set<NotificationTab>());
	const shownAccount = useRef<AccountNotification[] | null>(null);
	const savedIds = useRef(new Set<string>());
	const changelogSaved = useRef(false);

	if (!state) return null;
	const hasUnread = state.unread.account || state.unread.changelog;

	// Saved as soon as a tab is seen, so closing and leaving straight away can't lose it. The
	// highlights stay until the panel closes. A request cut off by leaving the page just leaves
	// things unread for next time.
	const saveAccountRead = () => {
		const ids = (shownAccount.current ?? []).filter((n) => !n.readAt && !savedIds.current.has(n.id)).map((n) => n.id);
		if (ids.length === 0) return;
		ids.forEach((id) => savedIds.current.add(id));
		markNotificationsRead(ids).catch(() => undefined);
	};

	const saveChangelogSeen = () => {
		if (changelogSaved.current || !state.unread.changelog) return;
		changelogSaved.current = true;
		markChangelogSeen().catch(() => undefined);
	};

	const show = (next: NotificationTab) => {
		setTab(next);
		viewed.current.add(next);
		if (next === "account") saveAccountRead();
		if (next === "changelog") saveChangelogSeen();
	};

	const changeOpen = (next: boolean) => {
		if (next) {
			viewed.current.clear();
			shownAccount.current = null;
			savedIds.current.clear();
			changelogSaved.current = false;
			show(state.unread.account || !state.unread.changelog ? "account" : "changelog");
		} else {
			// Only clear the dot for reminders that were actually loaded and saved.
			if (viewed.current.has("account") && shownAccount.current) state.markAccountRead();
			if (changelogSaved.current) state.markChangelogSeen();
		}
		setOpen(next);
	};

	const markAllRead = () => {
		saveAccountRead();
		state.markAccountRead();
	};

	const label = hasUnread ? "Notifications, unread" : "Notifications";
	const dot = hasUnread && (
		<span
			className="absolute right-0 top-0 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
			aria-hidden
			data-testid="notification-dot"
		/>
	);

	return (
		<Popover open={open} onOpenChange={changeOpen}>
			<PopoverTrigger asChild>
				{variant === "row" ? (
					<button
						type="button"
						className={sidebarItemClass(open)}
						aria-label={label}
						title={isCollapsed ? "Notifications" : undefined}
					>
						<span className="relative shrink-0">
							<Bell className="h-4 w-4" aria-hidden />
							{dot}
						</span>
						<span
							className={cn("whitespace-nowrap transition-opacity duration-150", isCollapsed && "opacity-0")}
							aria-hidden
						>
							Notifications
						</span>
					</button>
				) : (
					<button
						type="button"
						aria-label={label}
						className="relative flex h-11 w-11 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<span className="relative">
							<Bell className="h-5 w-5" aria-hidden />
							{dot}
						</span>
					</button>
				)}
			</PopoverTrigger>
			<PopoverContent
				side={side}
				align={align}
				sideOffset={8}
				collisionPadding={16}
				className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl p-0"
			>
				{open && (
					<NotificationPanel
						tab={tab}
						onTabChange={show}
						onAccountLoaded={(loaded) => {
							shownAccount.current = loaded;
							if (viewed.current.has("account")) saveAccountRead();
						}}
						onMarkAllRead={markAllRead}
						onNavigate={() => changeOpen(false)}
					/>
				)}
			</PopoverContent>
		</Popover>
	);
}
