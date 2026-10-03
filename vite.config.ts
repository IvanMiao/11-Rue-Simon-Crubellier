import path from 'path';
import fs from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiKey = command === 'serve' ? env.GEMINI_API_KEY : '';
    const input = {
      main: path.resolve(__dirname, 'index.html'),
      ...(fs.existsSync(path.resolve(__dirname, 'style-lab.html'))
        ? { styleLab: path.resolve(__dirname, 'style-lab.html') }
        : {}),
    };
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey)
      },
      build: { rollupOptions: { input } },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
