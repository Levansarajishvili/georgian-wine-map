// vite.config.js
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Vitest (01 §2: no separate config file). domain/ tests are pure functions
  // and run in node; tests that need a DOM are not part of the project yet.
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
