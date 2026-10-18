/** @type {import('tailwindcss').Config} */
export default {
  // Paths are relative to this file, not to the folder the dev server was started from
  content: { relative: true, files: ['./index.html', './src/**/*.{js,jsx}'] },
  theme: {
    extend: {
      colors: {
        // NClean brand, from the logo: teal buttons (a deeper shade of the logo teal, so white text reads), navy text
        primary: { DEFAULT: '#00857A', dark: '#006E65' },
        secondary: { DEFAULT: '#062C5A', dark: '#041F40' },
        // The logo's own teal and its sky → blue wave, for accents and charts
        brand: { teal: '#05AB9C', blue: '#007BCA', sky: '#02BEFC' },
      },
    },
  },
  plugins: [],
};
