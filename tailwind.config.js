/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // iOS 26 Semantic Colors
        background: 'var(--background)',
        surface: 'var(--surface)',
        'surface-hover': 'var(--surface-hover)',
        border: 'var(--border)',
        'border-focus': 'var(--border-focus)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-light': 'var(--accent-light)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',

        // iOS 26 Accents (from Figma)
        'ios-red': '#FF3B30',
        'ios-orange': '#FF9500',
        'ios-yellow': '#FFCC00',
        'ios-green': '#34C759',
        'ios-mint': '#00C7BE',
        'ios-teal': '#30B0C7',
        'ios-cyan': '#32ADE6',
        'ios-blue': '#007AFF',
        'ios-indigo': '#5856D6',
        'ios-purple': '#AF52DE',
        'ios-pink': '#FF2D55',

        // Category Colors - iOS palette
        'cat-groceries': '#34C759',
        'cat-transport': '#007AFF',
        'cat-dining': '#FF9500',
        'cat-utilities': '#5856D6',
        'cat-entertainment': '#FF2D55',
        'cat-shopping': '#FFCC00',
        'cat-health': '#00C7BE',
        'cat-other': '#8E8E93',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '-0.01em' }],
        base: ['1rem', { lineHeight: '1.375rem', letterSpacing: '-0.01em' }],
        lg: ['1.0625rem', { lineHeight: '1.375rem', letterSpacing: '-0.02em' }],
        xl: ['1.25rem', { lineHeight: '1.5rem', letterSpacing: '-0.02em' }],
        '2xl': ['1.5rem', { lineHeight: '1.75rem', letterSpacing: '-0.02em' }],
        '3xl': ['2.125rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
      },
      spacing: {
        '18': '4.5rem',
      },
      maxWidth: {
        'app': '800px',
      },
      borderRadius: {
        sm: '10px',
        md: '14px',
        lg: '18px',
        xl: '22px',
        '2xl': '26px',
        '3xl': '32px',
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 12px rgba(0, 0, 0, 0.06)',
        'elevated': '0 8px 24px rgba(0, 0, 0, 0.1)',
        'glass': '0 2px 20px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
        'glass-pill': '0 1px 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '1' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
