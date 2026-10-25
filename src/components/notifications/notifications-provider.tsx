"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { UnreadNotifications } from "@/lib/notifications";

interface NotificationsState {
	unread: UnreadNotifications;
	/** When What's new was last opened; null means never. */
	changelogSeenAt: string | null;
	signedUpAt: string;
	inAppEnabled: boolean;
	markAccountRead: () => void;
	markChangelogSeen: () => void;
}

const NotificationsContext = createContext<NotificationsState | null>(null);

interface NotificationsProviderProps {
	unread: UnreadNotifications;
	changelogSeenAt: string | null;
	signedUpAt: string;
	inAppEnabled: boolean;
	children: React.ReactNode;
}

/** One unread state for both bells (sidebar and phone top bar), so they always agree. */
export function NotificationsProvider({
	unread: initialUnread,
	changelogSeenAt: initialSeenAt,
	signedUpAt,
	inAppEnabled,
	children,
}: NotificationsProviderProps) {
	const [unread, setUnread] = useState(initialUnread);
	const [changelogSeenAt, setChangelogSeenAt] = useState(initialSeenAt);

	const { account, changelog } = initialUnread;
	useEffect(() => setUnread({ account, changelog }), [account, changelog]);
	useEffect(() => setChangelogSeenAt(initialSeenAt), [initialSeenAt]);

	return (
		<NotificationsContext.Provider
			value={{
				unread,
				changelogSeenAt,
				signedUpAt,
				inAppEnabled,
				markAccountRead: () => setUnread((current) => ({ ...current, account: false })),
				markChangelogSeen: () => {
					setUnread((current) => ({ ...current, changelog: false }));
					setChangelogSeenAt(new Date().toISOString());
				},
			}}
		>
			{children}
		</NotificationsContext.Provider>
	);
}

export function useNotifications(): NotificationsState | null {
	return useContext(NotificationsContext);
}
