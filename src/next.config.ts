import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true, //React's Strict Mode, identify potential problems in the application
	devIndicators: {
		buildActivity: false,
		appIsrStatus: false,
	},
	experimental: {
		serverActions: {
			bodySizeLimit: "5mb",
		},
	},
};

export default nextConfig;
