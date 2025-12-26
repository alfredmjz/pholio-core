import type { Config } from "tailwindcss";

const config: Config = {
	darkMode: ["class"],
	content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./styles/**/*.css"],
	theme: {
		extend: {
			colors: {
				background: "hsl(var(--background))",
				border: "hsl(var(--border))",
				ring: "hsl(var(--ring))",
				text: {
					DEFAULT: "hsl(var(--text-primary))",
					muted: "hsl(var(--text-muted))",
					secondary: "hsl(var(--text-secondary))",
				},
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
					muted: "hsl(var(--card-muted))",
				},
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
					hover: "hsl(var(--primary-hover))",
					border: "hsl(var(--primary-border))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
					hover: "hsl(var(--secondary-hover))",
					muted: "hsl(var(--secondary-muted))",
					border: "hsl(var(--secondary-border))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
					muted: "hsl(var(--accent-muted))",
					playful: "hsl(var(--accent-playful))",
				},
				hover: {
					DEFAULT: "hsl(var(--hover))",
				},
				muted: {
					DEFAULT: "hsl(var(--card-muted))",
					foreground: "hsl(var(--text-muted))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
					muted: "hsl(var(--popover-muted))",
				},
				success: {
					DEFAULT: "hsl(var(--success))",
					foreground: "hsl(var(--success-foreground))",
					muted: "hsl(var(--success-muted))",
				},
				warning: {
					DEFAULT: "hsl(var(--warning))",
					foreground: "hsl(var(--warning-foreground))",
					muted: "hsl(var(--warning-muted))",
				},
				error: {
					DEFAULT: "hsl(var(--error))",
					foreground: "hsl(var(--error-foreground))",
					muted: "hsl(var(--error-muted))",
				},
				info: {
					DEFAULT: "hsl(var(--info))",
					foreground: "hsl(var(--info-foreground))",
					muted: "hsl(var(--info-muted))",
				},
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			fontFamily: {
				sans: ["Geist", "serif"],
			},
		},
	},
	plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;

