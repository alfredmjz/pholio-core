"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CreditCard, Loader2 } from "lucide-react";
import { SegmentedChoice } from "@/components/common/segmented-choice";
import { Button } from "@/components/ui/button";
import { getAccountNotifications } from "@/lib/actions/notification-actions";
import { CHANGELOG, isEntryUnread } from "@/lib/changelog";
import { formatDateParts, formatMoney } from "@/lib/format";
import { formatLongDate, getTodayDateString, parseLocalDate } from "@/lib/date-utils";
import { notificationHref, type AccountNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { useNotifications } from "./notifications-provider";

export type NotificationTab = "account" | "changelog";

const NOTIFICATION_ICON = { card_due: CreditCard, recurring_due: CalendarClock, fee_due: AlertTriangle };

interface NotificationPanelProps {
	tab: NotificationTab;
	onTabChange: (tab: NotificationTab) => void;
	/** Reports the account reminders shown, so closing the panel can mark the unread ones read. */
	onAccountLoaded: (notifications: AccountNotification[]) => void;
	onMarkAllRead: () => void;
	onNavigate: () => void;
}

const MS_PER_DAY = 86_400_000;

function dueLabel(dueDate: string, today: string): string {
	const days = Math.round((parseLocalDate(dueDate).getTime() - parseLocalDate(today).getTime()) / MS_PER_DAY);
	if (days === 0) return "due today";
	if (days === 1) return "due tomorrow";
	const date = formatDateParts(parseLocalDate(dueDate), { weekday: "short", month: "short", day: "numeric" });
	return days < 0 ? `was due ${date}` : `due ${date}`;
}

/** The bell's panel: payment reminders under Account, and release notes under What's new. */
export function NotificationPanel({
	tab,
	onTabChange,
	onAccountLoaded,
	onMarkAllRead,
	onNavigate,
}: NotificationPanelProps) {
	const state = useNotifications();
	const [notifications, setNotifications] = useState<AccountNotification[] | null>(null);
	const today = getTodayDateString();

	useEffect(() => {
		let cancelled = false;
		getAccountNotifications()
			.then((loaded) => {
				if (cancelled) return;
				setNotifications(loaded);
				onAccountLoaded(loaded);
			})
			.catch(() => {
				if (!cancelled) setNotifications([]);
			});
		return () => {
			cancelled = true;
		};
		// Loaded once each time the panel opens.
	}, []);

	const hasUnreadAccount = notifications ? notifications.some((n) => !n.readAt) : Boolean(state?.unread.account);

	return (
		<div className="flex max-h-[min(32rem,calc(100dvh-8rem))] flex-col">
			<h2 className="type-h4 px-4 pb-3 pt-4 text-primary">Notifications</h2>
			<div className="px-4 pb-3">
				<SegmentedChoice
					label="Show"
					value={tab}
					onChange={onTabChange}
					itemClassName="h-9"
					options={[
						{ value: "account", label: "Account", indicator: hasUnreadAccount },
						{ value: "changelog", label: "What's new", indicator: Boolean(state?.unread.changelog) },
					]}
				/>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto border-t border-border/60">
				{tab === "account" ? (
					<AccountList
						notifications={notifications}
						today={today}
						inAppEnabled={state?.inAppEnabled ?? true}
						onNavigate={onNavigate}
					/>
				) : (
					<ChangelogList seenAt={state?.changelogSeenAt ?? null} signedUpAt={state?.signedUpAt ?? ""} />
				)}
			</div>

			{tab === "account" && hasUnreadAccount && notifications && (
				<div className="flex justify-end border-t border-border/60 px-3 py-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setNotifications(
								(current) => current?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null
							);
							onMarkAllRead();
						}}
					>
						Mark all as read
					</Button>
				</div>
			)}
		</div>
	);
}

function AccountList({
	notifications,
	today,
	inAppEnabled,
	onNavigate,
}: {
	notifications: AccountNotification[] | null;
	today: string;
	inAppEnabled: boolean;
	onNavigate: () => void;
}) {
	if (notifications === null) {
		return (
			<div className="flex justify-center py-10" role="status" aria-label="Loading notifications">
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
			</div>
		);
	}

	if (notifications.length === 0) {
		return (
			<p className="type-body-sm px-4 py-8 text-center text-muted-foreground">
				{inAppEnabled ? (
					"Nothing coming up. Credit card payments, bills and subscriptions show here before they're due."
				) : (
					<>
						Reminders in Pholio are off.{" "}
						<Link
							href="/settings#notifications"
							onClick={onNavigate}
							className="text-primary underline underline-offset-2"
						>
							Turn them on
						</Link>
					</>
				)}
			</p>
		);
	}

	return (
		<ul className="divide-y divide-border/50" aria-label="Account notifications">
			{notifications.map((notification) => {
				const unread = !notification.readAt;
				const Icon = NOTIFICATION_ICON[notification.kind] ?? CalendarClock;
				return (
					<li key={notification.id}>
						<Link
							href={notificationHref(notification)}
							onClick={onNavigate}
							className="row-interactive flex items-start gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
						>
							<span
								className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/[0.06] text-muted-foreground"
								aria-hidden
							>
								<Icon className="h-4 w-4" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="flex items-center gap-2">
									<span className={cn("type-body-sm truncate text-primary", unread && "font-medium")}>
										{notification.name}
									</span>
									{unread && <span className="sr-only">Unread</span>}
								</span>
								<span className="type-body-xs block text-muted-foreground">
									{notification.detail}, {formatMoney(notification.amount, { showCents: true })},{" "}
									{dueLabel(notification.dueDate, today)}
								</span>
							</span>
							{unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-error" aria-hidden />}
						</Link>
					</li>
				);
			})}
		</ul>
	);
}

function ChangelogList({ seenAt, signedUpAt }: { seenAt: string | null; signedUpAt: string }) {
	return (
		<ol className="divide-y divide-border/50" aria-label="What's new">
			{CHANGELOG.map((entry) => {
				const unread = signedUpAt !== "" && isEntryUnread(entry, seenAt, signedUpAt);
				return (
					<li key={entry.id} className="px-4 py-4">
						<p className="type-body-xs flex items-center gap-2 text-muted-foreground">
							<span>{formatLongDate(entry.date)}</span>
							{entry.version && <span>v{entry.version}</span>}
							{unread && (
								<>
									<span className="h-1.5 w-1.5 rounded-full bg-error" aria-hidden />
									<span className="sr-only">New</span>
								</>
							)}
						</p>
						<h3 className="type-body mt-1 font-medium text-primary">{entry.title}</h3>
						<ul className="type-body-sm mt-2 list-disc space-y-1 pl-5 text-muted-foreground marker:text-muted-foreground">
							{entry.items.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</li>
				);
			})}
		</ol>
	);
}
