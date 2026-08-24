import type { SecureStorage } from './secureStorage';

/**
 * Almacén de credenciales para la web. **Solo para desarrollo.**
 *
 * `expo-secure-store` no tiene implementación web —su módulo exporta un objeto
 * vacío—, así que sin esto la app se cae al llegar a la pantalla del PIN. El
 * respaldo es `localStorage`, que **no es un almacén seguro**: cualquier script
 * de la misma página puede leerlo y persiste en claro en el disco del navegador.
 *
 * Por qué es aceptable aquí y solo aquí:
 *
 *  - Metro resuelve `.web.ts` únicamente al empaquetar para navegador. Este
 *    archivo **no puede** acabar dentro del APK ni del IPA, ni por descuido.
 *  - Web no es una plataforma de distribución de NEUROpass: la app no puede
 *    bloquear nada desde un navegador. El objetivo es poder revisar la interfaz
 *    y el motor de ejercicios desde una computadora sin emulador.
 *  - `isSecure` es `false`, y la interfaz lo usa para mostrarlo en pantalla en
 *    lugar de fingir un nivel de protección que no existe.
 *
 * Lo que se guarda sigue siendo el derivado PBKDF2, nunca el PIN: la lógica de
 * `pin.ts` no cambia. Lo que se pierde es el respaldo en hardware.
 */

const PREFIX = 'neuropass.dev.';

let warned = false;

function warnOnce(): void {
  if (warned) return;
  warned = true;
  console.warn(
    '[NEUROpass] Ejecutando en navegador: las credenciales se guardan en localStorage, ' +
      'que NO es un almacén seguro. Es un modo de desarrollo para revisar la interfaz. ' +
      'En Android e iOS se usan Keystore y Keychain.',
  );
}

/** `localStorage` no existe durante el renderizado en servidor de Expo Router. */
const available = (): boolean => typeof window !== 'undefined' && Boolean(window.localStorage);

export const secureStorage: SecureStorage = {
  isSecure: false,

  async getItem(key) {
    warnOnce();
    if (!available()) return null;
    return window.localStorage.getItem(PREFIX + key);
  },

  async setItem(key, value) {
    warnOnce();
    if (!available()) return;
    window.localStorage.setItem(PREFIX + key, value);
  },

  async removeItem(key) {
    if (!available()) return;
    window.localStorage.removeItem(PREFIX + key);
  },
};
