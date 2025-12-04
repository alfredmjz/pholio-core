import type { Config } from 'tailwindcss';

const config: Config = {
	darkMode: ['class'],
	content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './styles/**/*.css'],
	theme: {
		extend: {
			colors: {
				ring: 'var(--ring)',
				background: 'var(--background)',
				foreground: 'var(--foreground)',
				border: 'var(--border)',
				card: {
					DEFAULT: 'var(--card)',
					foreground: 'var(--card-foreground)',
				},
				primary: {
					DEFAULT: 'var(--primary)',
					highlight: 'var(--primary-highlight)',
					muted: 'var(--primary-muted)',
				},
				secondary: {
					DEFAULT: 'var(--secondary)',
					highlight: 'var(--secondary-highlight)',
					muted: 'var(--secondary-muted)',
				},
				accent: {
					DEFAULT: 'var(--accent)',
				},
				constructive: {
					DEFAULT: 'var(--constructive)',
					muted: 'var(--constructive-muted)',
				},
				warning: {
					DEFAULT: 'var(--warning)',
					muted: 'var(--warning-muted)',
				},
				destructive: {
					DEFAULT: 'var(--destructive)',
					muted: 'var(--destructive-muted)',
				},
				informational: {
					DEFAULT: 'var(--informational)',
					muted: 'var(--informational-muted)',
				},
			},
			textColor: {
				primary: {
					DEFAULT: 'var(--text-primary)',
				},
				secondary: {
					DEFAULT: 'var(--text-secondary)',
					highlight: 'var(--text-secondary-highlight)',
				},
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			width: {
				half: '50%',
			},
			fontFamily: {
				sans: ['Geist', 'serif'],
			},
		},
	},
	plugins: [require('tailwindcss-animate')],
};

export default config;
