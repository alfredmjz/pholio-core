import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true, //React's Strict Mode, identify potential problems in the application
	devIndicators: {
		buildActivity: false,
		appIsrStatus: false,
	},
};

export default nextConfig;
