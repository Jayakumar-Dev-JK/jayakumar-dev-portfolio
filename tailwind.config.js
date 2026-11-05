/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Admin design tokens. The values equal Tailwind's stock slate/teal/red/amber scales,
      // named by role so the admin UI reads the same everywhere.
      colors: {
        admin: {
          app: '#0F172A',
          card: 'rgba(30,41,59,.3)',
          input: 'rgba(30,41,59,.5)',
          border: '#334155',
          subtle: 'rgba(51,65,85,.7)',
          heading: '#5EEAD4',
          strong: '#F1F5F9',
          label: '#E2E8F0',
          body: '#CBD5E1',
          muted: '#94A3B8', // hints and captions (4.5:1 on app)
          placeholder: '#8795AB', // placeholders: 5.4:1 on the input background
          accent: '#5EEAD4',
          'accent-bright': '#2DD4BF',
          'accent-text': '#99F6E4',
          'accent-bg': 'rgba(45,212,191,.1)',
          'accent-bg-hover': 'rgba(45,212,191,.2)',
          'accent-border': 'rgba(45,212,191,.4)',
          'danger-text': '#FCA5A5',
          'danger-soft': '#FECACA',
          'danger-bg': 'rgba(248,113,113,.1)',
          'danger-border': 'rgba(248,113,113,.4)',
          'warn-text': '#FDE68A',
          'warn-bg': 'rgba(251,191,36,.1)',
          'warn-border': 'rgba(251,191,36,.4)',
          'draft-bg': 'rgba(51,65,85,.6)',
          'info-bg': 'rgba(30,41,59,.6)',
        },
      },
      fontFamily: {
        admin: ['Inter', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        dialog: '12px',
      },
      maxWidth: {
        shell: '1192px',
      },
      boxShadow: {
        overlay: '0 12px 32px rgba(2,6,23,.55)',
      },
      keyframes: {
        shimmer: {
          to: { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}
