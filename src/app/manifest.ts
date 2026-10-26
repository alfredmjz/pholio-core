import type { MetadataRoute } from "next";

// Lets "Add to Home screen" use full-bleed icons, so launchers don't sit the logo on a white badge.
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Pholio",
		short_name: "Pholio",
		start_url: "/",
		display: "standalone",
		background_color: "#f3efe7",
		theme_color: "#f3efe7",
		icons: [
			{ src: "/icon-maskable-192.png?v=3", sizes: "192x192", type: "image/png", purpose: "maskable" },
			{ src: "/icon-maskable-512.png?v=3", sizes: "512x512", type: "image/png", purpose: "maskable" },
			{ src: "/pholio-icon.png?v=3", sizes: "256x256", type: "image/png", purpose: "any" },
		],
	};
}
