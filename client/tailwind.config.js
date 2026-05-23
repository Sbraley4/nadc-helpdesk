/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1B2A4A",
          light: "#2D4270",
          dark: "#111B30",
        },
        accent: "#E63946",
      },
    },
  },
  plugins: [],
}
