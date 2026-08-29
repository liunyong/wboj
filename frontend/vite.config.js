import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      __APP_ENV__: env.APP_ENV
    },
    test: {
      environment: 'jsdom',
      setupFiles: './vitest.setup.js'
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/katex')) return 'vendor-katex';
            if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark-') || id.includes('node_modules/rehype-')) return 'vendor-markdown';
            if (id.includes('node_modules/@tanstack')) return 'vendor-query';
            return undefined;
          }
        }
      }
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:4000',
          changeOrigin: true
        }
      }
    }
  };
});
