// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Todo esto es salida de herramientas, no código fuente: analizarlo produce
    // miles de avisos sobre bundles minificados que nadie va a corregir.
    // `.claude/` guarda material de trabajo —como los prototipos del handoff de
    // diseño— que es referencia y no se compila con la app.
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'android/*', 'ios/*', '.claude/**'],
  },
]);
