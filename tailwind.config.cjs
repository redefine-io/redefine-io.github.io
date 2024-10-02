const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      fontFamily: {
        mont: ["Montserrat Alternates", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        "redefine-primary": "#fa8072",
        "redefine-secondary": "#1e435b",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
