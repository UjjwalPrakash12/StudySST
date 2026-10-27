/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        stream: {
          dark: '#0c0e14',
          card: '#141721',
          surface: '#1c202e',
          border: '#2a2f42',
          primary: '#6366f1',
          primaryHover: '#4f46e5',
          accent: '#ec4899',
          emerald: '#10b981',
          amber: '#f59e0b',
        }
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-up': 'floatUp 2.5s ease-out forwards',
      },
      keyframes: {
        floatUp: {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '1' },
          '100%': { transform: 'translateY(-120px) scale(1.2)', opacity: '0' },
        }
      }
    },
  },
  plugins: [],
}
