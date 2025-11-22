import type { Config } from 'tailwindcss';
import uiConfig from '@repo/ui/tailwind.config';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  presets: [uiConfig],
};

export default config;
