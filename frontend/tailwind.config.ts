/**
 * @type {import('@types/tailwindcss/tailwind-config').TailwindConfig}
 */
module.exports = {
  content: [
    "./src/components/*.{ts,tsx,js,jsx}",
    "./src/app/*.{ts,tsx, js, jsx}",
    "./public/**/*.html",
  ],
  plugins: [],
  theme: {},
};
