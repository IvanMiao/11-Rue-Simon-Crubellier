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
      ...(fs.existsSync(path.resolve(__dirname, 'cast.html'))
        ? { cast: path.resolve(__dirname, 'cast.html') }
        : {}),
      ...(fs.existsSync(path.resolve(__dirname, 'cells.html'))
        ? { cells: path.resolve(__dirname, 'cells.html') }
        : {}),
      ...(fs.existsSync(path.resolve(__dirname, 'building.html'))
        ? { building: path.resolve(__dirname, 'building.html') }
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
