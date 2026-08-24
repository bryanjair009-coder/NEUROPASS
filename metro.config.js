// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Configuración de Metro.
 *
 * Solo se aparta del valor por defecto en una cosa: registrar `.wasm` como
 * extensión de recurso. `expo-sqlite` implementa SQLite en el navegador
 * compilando wa-sqlite a WebAssembly, y sin esta línea el empaquetado web falla
 * al resolver `wa-sqlite.wasm`. En Android e iOS no cambia nada, porque allí
 * SQLite es la biblioteca nativa del sistema.
 */
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

module.exports = config;
