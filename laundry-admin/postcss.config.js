import { fileURLToPath } from 'node:url';

export default {
  plugins: {
    // Explicit path so Tailwind finds its config even when Vite is started from another folder
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) },
    autoprefixer: {},
  },
};
