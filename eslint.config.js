// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Todo esto es salida de herramientas, no código fuente: analizarlo produce
    // miles de avisos sobre bundles minificados que nadie va a corregir.
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'android/*', 'ios/*'],
  },
]);
