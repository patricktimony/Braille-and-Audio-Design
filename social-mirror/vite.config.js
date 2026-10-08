import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // also reachable from phones on the same Wi-Fi
    proxy: { '/api': 'http://localhost:3001' },
  },
});
