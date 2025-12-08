import type { Config } from 'tailwindcss';

const config: Config = {
	darkMode: ['class'],
	content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './styles/**/*.css'],
	theme: {
		extend: {
			colors: {
				notion: {
					bg: {
						light: '#FFFFFF',
						dark: '#191919',
					},
					sidebar: {
						light: '#F7F7F5',
						dark: '#202020',
					},
					hover: {
						light: '#EFEFEF',
						dark: '#2C2C2C',
					},
					border: {
						light: '#E9E9E7',
						dark: '#373737',
					},
					text: {
						primary: {
							light: '#37352F',
							dark: '#D4D4D4',
						},
						secondary: {
							light: '#787774',
							dark: '#9B9B9B',
						},
					},
					// Notion Accent Colors (Backgrounds and Text)
					red: {
						bg: { light: '#FFE2DD', dark: 'rgba(255, 115, 105, 0.1)' },
						text: { light: '#D44C47', dark: '#FF7369' },
					},
					orange: {
						bg: { light: '#FADEC9', dark: 'rgba(255, 163, 68, 0.1)' },
						text: { light: '#D9730D', dark: '#FFA344' },
					},
					yellow: {
						bg: { light: '#FDECC8', dark: 'rgba(255, 220, 73, 0.1)' },
						text: { light: '#CB912F', dark: '#FFDC49' },
					},
					green: {
						bg: { light: '#DBEDDB', dark: 'rgba(77, 171, 154, 0.1)' },
						text: { light: '#448361', dark: '#4DAB9A' },
					},
					blue: {
						bg: { light: '#D3E5EF', dark: 'rgba(82, 156, 202, 0.1)' },
						text: { light: '#337EA9', dark: '#529CCA' },
					},
					purple: {
						bg: { light: '#E8DEEE', dark: 'rgba(154, 109, 215, 0.1)' },
						text: { light: '#9065B0', dark: '#9A6DD7' },
					},
					pink: {
						bg: { light: '#F5E0E9', dark: 'rgba(226, 85, 161, 0.1)' },
						text: { light: '#C14C8A', dark: '#E255A1' },
					},
					gray: {
						bg: { light: '#F1F1EF', dark: '#373737' },
						text: { light: '#9B9A97', dark: '#979A9B' },
					},
					brown: {
						bg: { light: '#EFE3D5', dark: 'rgba(147, 114, 100, 0.1)' },
						text: { light: '#9F6B53', dark: '#937264' },
					},
				},
				// Semantic UI colors (mapped to Notion palette via CSS variables in globals.css)
				// Use these for component styling instead of direct Notion colors
				background: 'var(--background)',
				foreground: 'var(--foreground)',
				border: 'var(--border)',
				ring: 'var(--ring)',
				card: {
					DEFAULT: 'var(--card)',
					foreground: 'var(--card-foreground)',
				},
				primary: {
					DEFAULT: 'var(--primary)',
					foreground: 'var(--primary-foreground)',
					hover: 'var(--primary-hover)',
					border: 'var(--primary-border)',
				},
				secondary: {
					DEFAULT: 'var(--secondary)',
					foreground: 'var(--secondary-foreground)',
					hover: 'var(--secondary-hover)',
					border: 'var(--secondary-border)',
				},
				accent: {
					DEFAULT: 'var(--accent)',
					foreground: 'var(--accent-foreground)',
				},
				muted: {
					DEFAULT: 'var(--muted)',
					foreground: 'var(--muted-foreground)',
				},
				popover: {
					DEFAULT: 'var(--popover)',
					foreground: 'var(--popover-foreground)',
				},
				// Status colors for feedback and states
				success: {
					DEFAULT: 'var(--success)',
					foreground: 'var(--success-foreground)',
					muted: 'var(--success-muted)',
				},
				warning: {
					DEFAULT: 'var(--warning)',
					foreground: 'var(--warning-foreground)',
					muted: 'var(--warning-muted)',
				},
				error: {
					DEFAULT: 'var(--error)',
					foreground: 'var(--error-foreground)',
					muted: 'var(--error-muted)',
				},
				info: {
					DEFAULT: 'var(--info)',
					foreground: 'var(--info-foreground)',
					muted: 'var(--info-muted)',
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
