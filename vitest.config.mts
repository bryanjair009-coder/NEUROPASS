import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * El motor de ejercicios, la economía de tiempo y la criptografía del PIN son
 * TypeScript puro sin dependencias de React Native, así que se prueban en Node
 * directamente. La UI y la capa nativa quedan fuera de este runner a propósito.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Los tests de propiedad ejercitan cientos de miles de generaciones.
    testTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
