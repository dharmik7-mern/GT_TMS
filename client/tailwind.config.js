/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        display: ['"Syne"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#d9e8ff',
          200: '#bcd5ff',
          300: '#8eb8ff',
          400: '#5a8fff',
          500: '#3366ff',
          600: '#1a47f5',
          700: '#1234e1',
          800: '#152cb6',
          900: '#172c8f',
          950: '#111c57',
        },
        surface: {
          0: '#ffffff',
          50: '#f8f9fc',
          100: '#f1f3f9',
          200: '#e4e8f2',
          300: '#d0d6e8',
          400: '#b0bad4',
          500: '#8896b8',
          600: '#5e72a0',
          700: '#3d5080',
          800: '#253460',
          900: '#121e40',
          950: '#080e24',
        },
        accent: {
          violet: '#7c3aed',
          rose: '#f43f5e',
          amber: '#f59e0b',
          emerald: '#10b981',
          cyan: '#06b6d4',
          orange: '#f97316',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'radial-gradient(at 40% 20%, hsla(228,100%,74%,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(355,100%,93%,0.1) 0px, transparent 50%)',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(18,30,64,0.08), 0 1px 2px -1px rgba(18,30,64,0.06)',
        'card-hover': '0 4px 12px 0 rgba(18,30,64,0.12), 0 2px 6px -2px rgba(18,30,64,0.08)',
        'modal': '0 20px 60px -12px rgba(18,30,64,0.25)',
        'sidebar': '2px 0 20px 0 rgba(18,30,64,0.08)',
        'glow': '0 0 20px rgba(51,102,255,0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}
