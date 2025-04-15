/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'styles/**/*.css'],
	theme: {
		extend: {
			colors: {
				ring: 'var(--ring)',
				background: 'var(--background)',
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
					DEFAULT: 'var(--secondary)',
				},
				constructive: {
					DEFAULT: 'var(--constructive)',
				},
				destructive: {
					DEFAULT: 'var(--destructive)',
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
				lg: `var(--radius)`,
				md: `calc(var(--radius) - 2px)`,
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

