import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', 'three/examples/jsm/controls/OrbitControls.js'],
        },
      },
    },
  },
});
