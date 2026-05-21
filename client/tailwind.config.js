/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary:  { DEFAULT: '#00C982', dark: '#009963', light: '#E6FAF2' },
        dark:     '#0D1B2A',
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", 'sans-serif'],
      },
    },
  },
  plugins: [],
};
