import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      port: 3000,
      host: '0.0.0.0',
      watch: {
        // Keep Vite focused on frontend sources so Linux doesn't exhaust inotify
        // watchers on `.venv`, backend code, backup data, or SQLite artifacts.
        ignored: [
          '**/.git/**',
          '**/node_modules/**',
          '**/.venv/**',
          '**/backend/**',
          '**/backup/**',
          '**/data/**',
          '**/dist/**',
        ],
      },
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8003',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
