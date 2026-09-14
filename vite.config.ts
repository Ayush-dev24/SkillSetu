import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// @ts-ignore — local JS plugin, no declaration file needed
import { apiDevPlugin } from './api-dev-plugin.js'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins = [react(), tailwindcss()];
  try {
    // @ts-ignore
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}

  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  // The local api/ serverless functions are served directly during dev
  // (api-dev-plugin). The proxy below only handles any remaining routes.
  const liveTarget = env.VITE_LIVE_API_URL || 'https://skill-setu-mediator-e5l5.arcada.app';

  return {
    plugins: [...plugins, apiDevPlugin()],
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: processEnvDefines,
    server: {
      host: true,
      proxy: {
        // Non-api routes still go to the mediator; /api/* is handled locally.
        '/api': {
          target: liveTarget,
          changeOrigin: true,
          secure: false,
          // api-dev-plugin runs BEFORE this proxy, so only unmatched /api/*
          // requests reach here. Keep it as a fallback for routes not in api/.
        },
      },
    },
    preview: {
      host: true,
      proxy: {
        '/api': {
          target: liveTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
})
