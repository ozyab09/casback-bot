import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Сайт отдаётся с корня хоста Mini App, база '/' правильная.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { outDir: 'dist' },
  server: { port: 5173 },
});
