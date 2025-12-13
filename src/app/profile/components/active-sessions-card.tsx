"use client";

import { Button } from "@/components/ui/button";
import { Laptop, Smartphone, Globe, LogOut } from "lucide-react";
import { toast } from "sonner";

interface Session {
	id: string;
	device: string;
	browser: string;
	location: string;
	lastActive: string;
	current: boolean;
	icon: "laptop" | "mobile" | "globe";
}

const MOCK_SESSIONS: Session[] = [
	{
		id: "1",
		device: "Windows PC",
		browser: "Chrome 120.0",
		location: "New York, USA",
		lastActive: "Active now",
		current: true,
		icon: "laptop",
	},
	{
		id: "2",
		device: "iPhone 14 Pro",
		browser: "Safari",
		location: "New York, USA",
		lastActive: "2 hours ago",
		current: false,
		icon: "mobile",
	},
	{
		id: "3",
		device: "MacBook Air",
		browser: "Firefox",
		location: "New York, USA",
		lastActive: "3 days ago",
		current: false,
		icon: "laptop",
	},
];

export function ActiveSessionsCard() {
	const handleSignOutAll = () => {
		toast.success("Signed out of all other devices");
	};

	const handleSignOutSession = (id: string) => {
		toast.success("Session revoked");
	};

	const getIcon = (type: Session["icon"]) => {
		switch (type) {
			case "laptop":
				return <Laptop className="w-5 h-5" />;
			case "mobile":
				return <Smartphone className="w-5 h-5" />;
			default:
				return <Globe className="w-5 h-5" />;
		}
	};

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h3 className="text-lg font-medium">Active Sessions</h3>
				<p className="text-sm text-muted-foreground">Manage your active sessions on other devices</p>
			</div>

			<div className="flex flex-col gap-3">
				{MOCK_SESSIONS.map((session) => (
					<div key={session.id} className="flex items-start justify-between">
						<div className="flex items-start gap-4">
							<div className="p-2 bg-secondary rounded-full text-muted-foreground mt-0.5">{getIcon(session.icon)}</div>
							<div className="flex flex-col gap-1">
								<p className="text-sm font-medium leading-none">
									{session.device}
									{session.current && <span className="ml-2 text-xs text-success font-normal">(Current session)</span>}
								</p>
								<p className="text-xs text-muted-foreground">
									{session.browser} • {session.location}
								</p>
								<p className="text-xs text-muted-foreground">Last active: {session.lastActive}</p>
							</div>
						</div>
						{!session.current && (
							<Button
								variant="ghost"
								size="sm"
								className="text-muted-foreground hover:text-destructive"
								onClick={() => handleSignOutSession(session.id)}
							>
								Revoke
							</Button>
						)}
					</div>
				))}
			</div>

			<div>
				<Button variant="destructive" className="w-full sm:w-auto" onClick={handleSignOutAll}>
					<LogOut className="w-4 h-4 mr-2" />
					Sign out of all other devices
				</Button>
			</div>
		</div>
	);
}
