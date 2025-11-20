module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F54928',
          light: '#FFA726'
        },
        secondary: {
          DEFAULT: '#0A3F73',
          light: '#42A5F5'
        },
        accent: {
          green: '#66BB6A',
          orange: '#FF5722',
          blue: '#1F6FEB'
        }
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
}
