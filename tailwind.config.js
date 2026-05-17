/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        carbon: {
          950: '#050505',
          900: '#080808',
          850: '#0b0b0b',
          800: '#111111',
          700: '#1A1A1A',
        },
        lumina: {
          emerald: '#35D07F',
          blue: '#4facfe',
          white: '#FFFFFF',
          muted: '#8A8A8A',
        },
      },
      boxShadow: {
        'emerald-glow': '0 0 48px rgba(53, 208, 127, 0.22)',
        'blue-glow': '0 0 40px rgba(79, 172, 254, 0.18)',
      },
      animation: {
        'pulse-line': 'pulse-line 2.6s ease-in-out infinite',
      },
      keyframes: {
        'pulse-line': {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
