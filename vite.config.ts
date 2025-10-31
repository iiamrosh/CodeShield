import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { exec } from 'child_process';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'capacitor-sync',
          writeBundle() {
            // Auto-sync to Capacitor after build
            if (mode === 'production' || process.env.AUTO_SYNC === 'true') {
              exec('npx cap sync android', (error, stdout, stderr) => {
                if (error) {
                  console.error(`Capacitor sync error: ${error}`);
                  return;
                }
                console.log('✓ Capacitor sync completed');
                console.log(stdout);
              });
            }
          }
        }
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
