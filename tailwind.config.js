const colorsConfig = require("./src/lib/colors.json");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/app/**/*.{js,jsx,ts,tsx}", "./src/components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: colorsConfig.primary,
        secondary: colorsConfig.secondary,
      },
    },
  },
  plugins: [],
}