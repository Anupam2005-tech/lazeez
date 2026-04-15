/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/views/**/*.ejs",
    "./public/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          500: '#fc8019',
          600: '#e57317',
        },
        green: {
          600: '#1ba672'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
