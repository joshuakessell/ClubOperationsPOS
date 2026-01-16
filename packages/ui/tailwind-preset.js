import forms from '@tailwindcss/forms';

/**
 * @club-ops/ui shared Tailwind preset
 *
 * Design target: Tailwind UI “Application UI” (neutral surfaces, clean panels/cards, consistent
 * radius/shadows, and predictable focus rings).
 *
 * Notes:
 * - We use @tailwindcss/forms with `strategy: 'class'` to avoid surprising global form style changes
 *   while we migrate away from legacy CSS.
 * - Apps should add their device-context sizing defaults via thin wrappers in `apps/<app>/src/ui/*`.
 */
export default {
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'rgb(249 250 251)', // gray-50
          panel: 'rgb(255 255 255)', // white
          muted: 'rgb(243 244 246)', // gray-100
          border: 'rgb(229 231 235)', // gray-200
          text: 'rgb(17 24 39)', // gray-900
          textMuted: 'rgb(75 85 99)', // gray-600
          focus: 'rgb(79 70 229)', // indigo-600
        },
      },
      borderRadius: {
        app: '0.75rem', // “Application UI”-ish rounding for panels/cards
      },
      boxShadow: {
        // Subtle elevation (Application UI style)
        panel: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        card: '0 1px 3px 0 rgb(0 0 0 / 0.10), 0 1px 2px -1px rgb(0 0 0 / 0.10)',
        popover: '0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.10)',
      },
      ringColor: {
        DEFAULT: 'rgb(79 70 229 / 0.45)', // app.focus @ ~45%
      },
      ringOffsetWidth: {
        DEFAULT: '2px',
      },
    },
  },
  plugins: [forms({ strategy: 'class' })],
};

