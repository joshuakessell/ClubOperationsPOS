import preset from '@club-ops/ui/tailwind-preset';

export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
    '../../packages/ui/src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: { extend: {} },
};

