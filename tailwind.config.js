/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#F8F1EB',
        foreground: '#2B0E17',
        maroon: {
          50: '#FDF2F4',
          100: '#FCE7EB',
          200: '#F9D0D8',
          300: '#F4A9B8',
          400: '#EC748E',
          500: '#E11D48',
          600: '#BE123C',
          700: '#9F1239',
          800: '#881337',
          900: '#4D0E25',
          950: '#16080C',
        },
        cream: {
          50: '#FFFDF9',
          100: '#FAF4ED',
          200: '#F5EAE1',
          300: '#EDE0D4',
          400: '#E4CFBF',
          500: '#D5BAA6',
          600: '#B89983',
          700: '#8C6F5A',
          800: '#634D3C',
          900: '#3D2D22',
        },
        obsidian: '#2B0E17',
        wine: '#7B2E46',
        surface: 'rgba(255, 252, 248, 0.90)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(80, 24, 45, 0.08)',
        'glass-glow': '0 0 25px rgba(140, 42, 68, 0.15)',
        'maroon-glow': '0 0 40px rgba(140, 42, 68, 0.20)',
        'emerald-glow': '0 0 35px rgba(16, 185, 129, 0.25)',
      },
      keyframes: {
        'scan-line': {
          '0%, 100%': { transform: 'translateY(-100%)', opacity: '0.2' },
          '50%': { transform: 'translateY(100%)', opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.02)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'scan-line': 'scan-line 2.5s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
};
