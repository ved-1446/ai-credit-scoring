import colors from "tailwindcss/colors";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans Variable"', '"DM Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        xl: '0.625rem',
        '2xl': '0.75rem',
      },
      boxShadow: {
        xl: '0 4px 16px -2px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.04)',
        '2xl': '0 8px 24px -4px rgb(0 0 0 / 0.12), 0 4px 10px -3px rgb(0 0 0 / 0.06)',
      },
      borderColor: {
        DEFAULT: 'rgb(var(--slate-700) / <alpha-value>)',
      },
      divideColor: {
        DEFAULT: 'rgb(var(--slate-700) / <alpha-value>)',
      },
      ringColor: {
        DEFAULT: 'rgb(var(--slate-700) / <alpha-value>)',
      },
      outlineColor: {
        DEFAULT: 'rgb(var(--slate-700) / <alpha-value>)',
      },
      colors: {
        slate: {
          50: 'rgb(var(--slate-50) / <alpha-value>)',
          100: 'rgb(var(--slate-100) / <alpha-value>)',
          200: 'rgb(var(--slate-200) / <alpha-value>)',
          300: 'rgb(var(--slate-300) / <alpha-value>)',
          400: 'rgb(var(--slate-400) / <alpha-value>)',
          500: 'rgb(var(--slate-500) / <alpha-value>)',
          600: 'rgb(var(--slate-600) / <alpha-value>)',
          700: 'rgb(var(--slate-700) / <alpha-value>)',
          800: 'rgb(var(--slate-800) / <alpha-value>)',
          900: 'rgb(var(--slate-900) / <alpha-value>)',
          950: 'rgb(var(--slate-950) / <alpha-value>)',
        },
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          500: 'rgb(var(--accent) / <alpha-value>)',
        },
        yellow: {
          ...colors.yellow,
          200: 'rgb(var(--yellow-200) / <alpha-value>)',
          300: 'rgb(var(--yellow-300) / <alpha-value>)',
          400: 'rgb(var(--yellow-400) / <alpha-value>)',
        },
        amber: {
          ...colors.amber,
          200: 'rgb(var(--amber-200) / <alpha-value>)',
          300: 'rgb(var(--amber-300) / <alpha-value>)',
          400: 'rgb(var(--amber-400) / <alpha-value>)',
        },
        orange: {
          ...colors.orange,
          200: 'rgb(var(--orange-200) / <alpha-value>)',
          300: 'rgb(var(--orange-300) / <alpha-value>)',
          400: 'rgb(var(--orange-400) / <alpha-value>)',
        },
        red: {
          ...colors.red,
          200: 'rgb(var(--red-200) / <alpha-value>)',
          300: 'rgb(var(--red-300) / <alpha-value>)',
          400: 'rgb(var(--red-400) / <alpha-value>)',
        },
        rose: {
          ...colors.rose,
          200: 'rgb(var(--rose-200) / <alpha-value>)',
          300: 'rgb(var(--rose-300) / <alpha-value>)',
          400: 'rgb(var(--rose-400) / <alpha-value>)',
        },
        emerald: {
          ...colors.emerald,
          200: 'rgb(var(--emerald-200) / <alpha-value>)',
          300: 'rgb(var(--emerald-300) / <alpha-value>)',
          400: 'rgb(var(--emerald-400) / <alpha-value>)',
        },
        green: {
          ...colors.green,
          200: 'rgb(var(--green-200) / <alpha-value>)',
          300: 'rgb(var(--green-300) / <alpha-value>)',
          400: 'rgb(var(--green-400) / <alpha-value>)',
        },
        teal: {
          ...colors.teal,
          200: 'rgb(var(--teal-200) / <alpha-value>)',
          300: 'rgb(var(--teal-300) / <alpha-value>)',
          400: 'rgb(var(--teal-400) / <alpha-value>)',
        },
        sky: {
          ...colors.sky,
          200: 'rgb(var(--sky-200) / <alpha-value>)',
          300: 'rgb(var(--sky-300) / <alpha-value>)',
          400: 'rgb(var(--sky-400) / <alpha-value>)',
        },
        blue: {
          ...colors.blue,
          200: 'rgb(var(--blue-200) / <alpha-value>)',
          300: 'rgb(var(--blue-300) / <alpha-value>)',
          400: 'rgb(var(--blue-400) / <alpha-value>)',
        },
        indigo: {
          ...colors.indigo,
          200: 'rgb(var(--indigo-200) / <alpha-value>)',
          300: 'rgb(var(--indigo-300) / <alpha-value>)',
          400: 'rgb(var(--indigo-400) / <alpha-value>)',
        },
        violet: {
          ...colors.violet,
          200: 'rgb(var(--violet-200) / <alpha-value>)',
          300: 'rgb(var(--violet-300) / <alpha-value>)',
          400: 'rgb(var(--violet-400) / <alpha-value>)',
        },
        purple: {
          ...colors.purple,
          200: 'rgb(var(--purple-200) / <alpha-value>)',
          300: 'rgb(var(--purple-300) / <alpha-value>)',
          400: 'rgb(var(--purple-400) / <alpha-value>)',
        },
      }
    },
  },
  plugins: [],
}
