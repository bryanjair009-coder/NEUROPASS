import * as SecureStore from 'expo-secure-store';

/**
 * Almacén de credenciales.
 *
 * Es la única pieza de la capa de seguridad que depende de la plataforma. Se
 * aísla aquí a propósito: la derivación PBKDF2, el bloqueo por intentos y la
 * política del PIN viven en `pin.ts`, `lockout.ts` y `pinStore.ts`, y no
 * cambian según dónde corra la app. Solo cambia *dónde se guardan los bytes*.
 *
 * Separarlo así evita el error clásico de tener dos implementaciones paralelas
 * de la lógica de seguridad —una por plataforma— que se desincronizan y donde
 * la versión menos usada acaba siendo la insegura.
 *
 * En Android e iOS respalda en Keystore y Keychain: el material queda cifrado
 * con una clave que no sale del hardware seguro. La variante web
 * (`secureStorage.web.ts`) no ofrece esa garantía y lo dice explícitamente.
 */

export interface SecureStorage {
  readonly isSecure: boolean;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const secureStorage: SecureStorage = {
  isSecure: true,
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
