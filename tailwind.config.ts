import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#F2F2F7',
        surface: '#FFFFFF',
        'surface-elevated': '#F5F5F5',
        border: '#E5E5EA',
        'text-primary': '#1C1C1E',
        'text-secondary': '#6C6C70',
        'text-placeholder': '#AEAEB2',
        orange: {
          DEFAULT: '#FF6B35',
          pressed: '#E55A25',
        },
        green: '#1ABC9C',
        red: '#FF4F6D',
        blue: '#007AFF',
        yellow: '#FFD700',
        purple: '#800080',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '14px',
        button: '10px',
        input: '8px',
        chip: '20px',
        sheet: '20px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)',
        fab: '0 4px 16px rgba(255,107,53,0.35)',
        sheet: '0 -4px 24px rgba(0,0,0,0.10)',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
      },
    },
  },
  plugins: [],
};

export default config;
