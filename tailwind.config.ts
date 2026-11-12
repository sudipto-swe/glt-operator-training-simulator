import type { Config } from 'tailwindcss';

/**
 * Design tokens are CSS variables (see src/styles/index.css) so light and dark
 * themes swap instantly without re-rendering the component tree.
 * Variables hold space-separated RGB triplets, e.g. "--c-surf: 17 26 43".
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surf: 'rgb(var(--c-surf) / <alpha-value>)',
        surf2: 'rgb(var(--c-surf2) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        ink2: 'rgb(var(--c-ink2) / <alpha-value>)',
        acc: 'rgb(var(--c-acc) / <alpha-value>)',
        ok: 'rgb(var(--c-ok) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        bad: 'rgb(var(--c-bad) / <alpha-value>)',
        crit: 'rgb(var(--c-crit) / <alpha-value>)'
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace'
        ]
      }
    }
  },
  plugins: []
} satisfies Config;
