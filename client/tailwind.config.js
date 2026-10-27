/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: '#CCD5AE',
        'soft-green': '#E9EDC9',
        ivory: '#FEFAE0',
        sand: '#FAEDCD',
        terracotta: '#D4A373',
        'terracotta-dark': '#B88252',
        'terracotta-hover': '#C59361',
        'text-primary': '#40382F',
        'text-secondary': '#75695A',
        'text-muted': '#9E9080',
        border: 'rgba(64, 56, 47, 0.14)',
        surface: '#FEFAE0',
      },
      borderRadius: {
        card: '16px',
        button: '10px',
      },
      boxShadow: {
        warm: '0 4px 20px -2px rgba(64, 56, 47, 0.06)',
        'warm-hover': '0 8px 30px -4px rgba(64, 56, 47, 0.12)',
        'warm-sm': '0 2px 8px -1px rgba(64, 56, 47, 0.05)',
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
