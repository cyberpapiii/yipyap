const withOpacityValue = (variable) => ({ opacityValue }) => {
  if (opacityValue === undefined) {
    return `hsl(${variable})`
  }
  return `hsl(${variable} / ${opacityValue})`
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // shadcn-svelte color system with YipYap branding
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        line: "hsl(var(--line))",
        // Anonymous avatar colors
        'anonymous-1': '#8b5cf6', // Purple
        'anonymous-2': '#3b82f6', // Blue
        'anonymous-3': '#10b981', // Green
        'anonymous-4': '#f59e0b', // Orange
        'anonymous-5': '#ef4444', // Red
        // Custom vote colors for YipYap
        'vote-up': {
          DEFAULT: "hsl(var(--vote-up))",
          hover: "hsl(var(--vote-up-hover))",
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        'vote-down': {
          DEFAULT: "hsl(var(--vote-down))",
          hover: "hsl(var(--vote-down-hover))",
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
      },
      fontFamily: {
        sans: ['ProtoMono', 'ui-monospace', 'SFMono-Regular', 'Monaco', 'Consolas', 'Liberation Mono', 'Menlo', 'Courier New', 'monospace'],
      },
      animation: {
        // Vote button animations for satisfying feedback
        'vote-bounce': 'vote-bounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'score-bounce': 'score-bounce 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'vote-pulse': 'vote-pulse 0.3s ease-out',
        'haptic-feedback': 'haptic-feedback 0.15s ease-out',

        // Loading and state animations
        'loading-pulse': 'loading-pulse 1.5s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',

        // Toast animations
        'toast-slide-in': 'toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'toast-slide-out': 'toast-slide-out 0.2s ease-in forwards',
      },
      keyframes: {
        'vote-bounce': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.25)' },
          '100%': { transform: 'scale(1)' }
        },
        'score-bounce': {
          '0%': { transform: 'scale(1) translateY(0)' },
          '50%': { transform: 'scale(1.15) translateY(-2px)' },
          '100%': { transform: 'scale(1) translateY(0)' }
        },
        'vote-pulse': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.4)', opacity: '0' }
        },
        'haptic-feedback': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' }
        },
        'loading-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' }
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        'toast-slide-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        'toast-slide-out': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' }
        }
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'vote': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'vote-active': '0 8px 25px -8px rgba(0, 0, 0, 0.25)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: []
}
