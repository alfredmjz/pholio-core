import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// The E2E suite builds into its own folder so it never clobbers a running `bun run dev`.
	distDir: process.env.NEXT_DIST_DIR || ".next",
	reactStrictMode: true, //React's Strict Mode, identify potential problems in the application
	devIndicators: {
		buildActivity: false,
		appIsrStatus: false,
	},
	// The Balance Sheet was renamed to Accounts; keep old links and bookmarks working.
	async redirects() {
		return [
			{ source: "/balancesheet", destination: "/accounts", permanent: true },
			{ source: "/balancesheet/accountdetail/:id", destination: "/accounts/:id", permanent: true },
		];
	},
	experimental: {
		serverActions: {
			bodySizeLimit: "5mb",
		},
	},
};

export default nextConfig;
