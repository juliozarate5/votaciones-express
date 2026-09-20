/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/views/**/*.ejs',
    './src/public/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8f7',
          100: '#d5efec',
          500: '#1a7a6d',
          700: '#0f4c5c',
          900: '#0a2f38',
        },
        accent: {
          400: '#e36414',
          500: '#c44900',
        },
      },
      fontFamily: {
        display: ['"Segoe UI"', 'system-ui', 'sans-serif'],
        body: ['"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
