/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				"redefine-primary": "#FA8072",
				"redefine-secondary": "#0B445D",
			}
		},
	},
	plugins: [],
}
