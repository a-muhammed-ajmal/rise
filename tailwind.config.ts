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
        background: '#0A0A0A',
        surface: '#141414',
        'surface-elevated': '#1C1C1C',
        border: '#2A2A2A',
        'text-primary': '#F0F0F0',
        'text-secondary': '#8A8A8A',
        'text-placeholder': '#505050',
        orange: {
          DEFAULT: '#FF6B35',
          pressed: '#E55A25',
        },
        green: '#1ABC9C',
        red: '#FF4F6D',
        blue: '#1E4AFF',
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
        card: '12px',
        button: '10px',
        input: '8px',
        chip: '20px',
        sheet: '20px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.4)',
        fab: '0 4px 16px rgba(255,107,53,0.4)',
        sheet: '0 -4px 24px rgba(0,0,0,0.6)',
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
