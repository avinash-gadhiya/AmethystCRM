import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { loadLocalHttps } from './scripts/local-https.mjs';
import { createLocalApiProxy, LOCAL_API_PREFIX } from './scripts/local-api-proxy.mjs';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resolvePath = (str) => path.resolve(__dirname, str);

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_URL = env.VITE_APP_BASE_NAME || '/';
  const apiTarget = env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api';
  const apiProxy = createLocalApiProxy(apiTarget);
  const PORT = 3000;
  const https = command === 'serve' ? loadLocalHttps(__dirname, { ...env, ...process.env }, mode === 'https') : undefined;

  return {
    server: {
      open: false,
      port: PORT,
      strictPort: false,
      host: true,
      https,
      proxy: apiProxy
    },
    preview: {
      open: false,
      host: true,
      strictPort: false,
      https,
      proxy: apiProxy
    },
    define: {
      global: 'window',
      ...(command === 'serve' ? { 'import.meta.env.VITE_APP_API_URL': JSON.stringify(LOCAL_API_PREFIX) } : {})
    },
    resolve: {
      alias: [
        { find: '@', replacement: resolvePath('src') }
      ]
    },
    css: {
      postcss: {
        plugins: [
          tailwindcss(),
          autoprefixer(),
          {
            postcssPlugin: 'internal:charset-removal',
            AtRule: {
              charset: (atRule) => {
                if (atRule.name === 'charset') {
                  atRule.remove();
                }
              }
            }
          }
        ]
      }
    },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        input: {
          main: resolvePath('index.html')
        }
      }
    },
    base: API_URL,
    plugins: [react(), tsconfigPaths()]
  };
});
