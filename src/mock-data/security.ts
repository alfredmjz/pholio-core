export interface Session {
	id: string;
	device: string;
	browser: string;
	location: string;
	lastActive: string;
	current: boolean;
	icon: "laptop" | "mobile" | "globe";
}

export const MOCK_SESSIONS: Session[] = [
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
