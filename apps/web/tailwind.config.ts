import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1440px' } },
    extend: {
      colors: {
        /* ===== Editorial palette ===== */
        ink: 'hsl(var(--ink))',
        paper: 'hsl(var(--paper))',
        surface: 'hsl(var(--surface))',
        'surface-elevated': 'hsl(var(--surface-elevated))',
        background: 'hsl(var(--background))',
        border: 'hsl(var(--border))',
        rule: 'hsl(var(--rule))',
        ring: 'hsl(var(--ring))',

        /* Accent (cherry) */
        accent: { DEFAULT: 'hsl(var(--accent))', strong: 'hsl(var(--accent-strong))' },
        'accent-soft': 'hsl(var(--accent-soft))',
        'accent-strong': 'hsl(var(--accent-strong))',
        'accent-muted': 'hsl(var(--accent-soft))', // backwards-compat alias

        /* Mute scale (Economist neutrals) */
        mute: {
          1: 'hsl(var(--mute-1))',
          2: 'hsl(var(--mute-2))',
          3: 'hsl(var(--mute-3))',
        },

        /* Text */
        text: {
          primary: 'hsl(var(--text-primary))',
          secondary: 'hsl(var(--text-secondary))',
          tertiary: 'hsl(var(--text-tertiary))',
        },
        'text-primary': 'hsl(var(--text-primary))',
        'text-secondary': 'hsl(var(--text-secondary))',
        'text-tertiary': 'hsl(var(--text-tertiary))',
        'text-quaternary': 'hsl(var(--text-quaternary))',

        /* Agency-categorical (fixed assignment, spec §4.1) */
        agency: {
          nih: 'hsl(var(--agency-nih))',
          nsf: 'hsl(var(--agency-nsf))',
          dod: 'hsl(var(--agency-dod))',
          doe: 'hsl(var(--agency-doe))',
          nasa: 'hsl(var(--agency-nasa))',
          usda: 'hsl(var(--agency-usda))',
          other: 'hsl(var(--agency-other))',
        },

        /* Semantic */
        positive: 'hsl(var(--positive))',
        negative: 'hsl(var(--negative))',
        warning: 'hsl(var(--warning))',
        highlight: 'hsl(var(--highlight))',

        /* Legacy categorical aliases (mapped to agency palette) */
        'cat-1': 'hsl(var(--cat-1))',
        'cat-2': 'hsl(var(--cat-2))',
        'cat-3': 'hsl(var(--cat-3))',
        'cat-4': 'hsl(var(--cat-4))',
        'cat-5': 'hsl(var(--cat-5))',
        'cat-6': 'hsl(var(--cat-6))',
        'cat-7': 'hsl(var(--cat-7))',

        /* Sequential blues (choropleth) */
        'seq-1': 'hsl(var(--seq-1))',
        'seq-2': 'hsl(var(--seq-2))',
        'seq-3': 'hsl(var(--seq-3))',
        'seq-4': 'hsl(var(--seq-4))',
        'seq-5': 'hsl(var(--seq-5))',
        'seq-6': 'hsl(var(--seq-6))',
        'seq-7': 'hsl(var(--seq-7))',

        /* Diverging (pink/green) */
        'div-neg-3': 'hsl(var(--div-neg-3))',
        'div-neg-2': 'hsl(var(--div-neg-2))',
        'div-neg-1': 'hsl(var(--div-neg-1))',
        'div-zero': 'hsl(var(--div-zero))',
        'div-pos-1': 'hsl(var(--div-pos-1))',
        'div-pos-2': 'hsl(var(--div-pos-2))',
        'div-pos-3': 'hsl(var(--div-pos-3))',
      },
      fontFamily: {
        /* Calibri stack — Carlito is the metric-compatible open fallback (from @fontsource/carlito). */
        sans: ['Calibri', 'Carlito', 'system-ui', 'sans-serif'],
        serif: ['Calibri', 'Carlito', 'system-ui', 'sans-serif'],
        mono: ['Calibri', 'Carlito', 'system-ui', 'sans-serif'],
        display: ['Calibri', 'Carlito', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        'hero': ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.015em' }],
        'num-hero': ['3rem', { lineHeight: '1', letterSpacing: '-0.01em' }],
        'num': ['0.9375rem', { lineHeight: '1.4' }],
      },
      borderRadius: { sm: '2px', DEFAULT: '4px', md: '6px', lg: '8px' },
      boxShadow: {
        'card': '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 1px 0 rgb(0 0 0 / 0.02)',
        'card-hover': '0 4px 8px -2px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
      },
    },
  },
};

export default config;
