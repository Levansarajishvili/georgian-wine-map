// vite.config.js
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Libraries go into their own files. The first visit downloads the same
        // number of bytes as one bundle did; the gain comes with the next
        // deploy: a change in src/ renames only index-*.js, so a returning
        // visitor keeps `ol` and `react` in the browser cache (vercel.json
        // serves /assets/* as immutable).
        // rbush and quickselect are OpenLayers' own dependencies; scheduler is React's.
        codeSplitting: {
          groups: [
            { name: 'ol', test: /node_modules[\\/](ol|rbush|quickselect)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  // Vitest (01 §2: no separate config file). domain/ tests are pure functions
  // and run in node; tests that need a DOM are not part of the project yet.
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
