/** @type {import('tailwindcss').Config} */
export default {
  // Tell Tailwind which files to scan for class names.
  // It only includes CSS for classes it finds here — keeping the bundle small.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      // SmartStock brand colors
      // These can be used as: bg-primary, text-primary-foreground, etc.
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',   // main brand blue
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Status colors used across the app
        success: '#22c55e',
        warning: '#f59e0b',
        danger:  '#ef4444',
        info:    '#3b82f6',
      },

      // Custom font sizes for invoice/print layouts
      fontSize: {
        'xxs': '0.625rem', // 10px — for fine print
      },

      // Screen sizes — add a custom 'xs' breakpoint for very small phones
      screens: {
        'xs': '375px',
      },

      // Custom animations
      keyframes: {
        'scan-line': {
          '0%, 100%': { top: '20%' },
          '50%':       { top: '78%' },
        },
      },
      animation: {
        'scan-line': 'scan-line 2s ease-in-out infinite',
      },
    },
  },

  plugins: [],
}
