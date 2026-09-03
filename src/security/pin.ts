import { fromHex, timingSafeEqual, toHex } from '@/lib/crypto/sha256';
import { deriveKey } from '@/security/kdf';

/**
 * PIN del tutor.
 *
 * Es la única frontera entre el menor y la configuración que limita su tiempo
 * de pantalla, así que se trata como una credencial de verdad y no como un
 * número guardado en claro.
 *
 * Modelo de amenaza realista, en orden de probabilidad:
 *
 *  1. **El menor prueba PINs a mano.** Es el ataque que de verdad ocurre. Se
 *     mitiga con bloqueo exponencial persistente (security/lockout.ts) y
 *     rechazando PINs adivinables (fecha de nacimiento, 123456, 000000).
 *  2. **El menor lee el almacenamiento de la app.** Se mitiga guardando solo
 *     un derivado PBKDF2 con sal, dentro de SecureStore (Keychain en iOS,
 *     Keystore en Android), nunca el PIN.
 *  3. **Extracción del dispositivo con root y ataque de fuerza bruta offline.**
 *     Un PIN de 6 dígitos tiene un espacio de 10⁶: ninguna función de
 *     derivación lo vuelve inatacable. Lo que sí hace PBKDF2 con 60 000
 *     iteraciones es encarecer ese millón de intentos varios órdenes de
 *     magnitud. Se documenta explícitamente en vez de fingir que es seguro.
 *
 * La comparación es siempre en tiempo constante: con un espacio tan chico, un
 * canal lateral por temporización sí sería explotable.
 */

export const PIN_MIN_LENGTH = 6;
export const PIN_MAX_LENGTH = 8;

/**
 * 60 000 iteraciones: en gama media Android la derivación tarda del orden de
 * 200–400 ms, imperceptible al desbloquear una vez, pero multiplica por 60 000
 * el costo de cada intento en un ataque offline. Si se sube, hay que subir
 * también `KDF_VERSION` y migrar los registros existentes.
 */
export const KDF_ITERATIONS = 60_000;
export const KDF_KEY_BYTES = 32;
export const KDF_SALT_BYTES = 16;
export const KDF_VERSION = 1;

/** Registro persistible. No contiene el PIN, solo su derivado. */
export interface PinRecord {
  readonly version: number;
  readonly saltHex: string;
  readonly hashHex: string;
  readonly iterations: number;
  /** Marca de tiempo de creación, para poder avisar de un PIN muy antiguo. */
  readonly createdAt: number;
}

export type PinRejection =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/**
 * PINs que aparecen en los primeros puestos de todos los estudios de
 * frecuencia y que un menor prueba en el primer minuto.
 */
const BLOCKED_PINS = new Set([
  '000000', '111111', '123456', '654321', '121212', '112233', '123123',
  '696969', '999999', '666666', '789456', '159753', '147258', '102030',
  '0000000', '1234567', '00000000', '12345678', '11111111', '87654321',
]);

/** Valida un PIN antes de aceptarlo. El mensaje va directo a la UI del tutor. */
export function validatePinStrength(pin: string): PinRejection {
  if (!/^\d+$/.test(pin)) {
    return { ok: false, reason: 'El PIN debe contener solo dígitos.' };
  }
  if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
    return {
      ok: false,
      reason: `El PIN debe tener entre ${PIN_MIN_LENGTH} y ${PIN_MAX_LENGTH} dígitos.`,
    };
  }
  if (BLOCKED_PINS.has(pin)) {
    return { ok: false, reason: 'Ese PIN es de los más usados del mundo. Elige otro.' };
  }
  if (new Set(pin).size === 1) {
    return { ok: false, reason: 'No uses el mismo dígito repetido.' };
  }
  if (isMonotonicRun(pin)) {
    return { ok: false, reason: 'No uses dígitos consecutivos como 123456 o 987654.' };
  }
  if (hasShortPeriod(pin)) {
    return { ok: false, reason: 'No repitas el mismo patrón corto, como 121212.' };
  }
  if (looksLikeYear(pin)) {
    return { ok: false, reason: 'Evita fechas: un año de nacimiento es lo primero que se prueba.' };
  }
  return { ok: true };
}

/** 123456 / 987654: todos los saltos entre dígitos consecutivos valen +1 o −1. */
function isMonotonicRun(pin: string): boolean {
  const step = (pin.charCodeAt(1) - pin.charCodeAt(0)) as number;
  if (step !== 1 && step !== -1) return false;
  for (let i = 2; i < pin.length; i += 1) {
    if (pin.charCodeAt(i) - pin.charCodeAt(i - 1) !== step) return false;
  }
  return true;
}

/** 121212 / 123123: el PIN es la repetición de un bloque de 1 a 3 dígitos. */
function hasShortPeriod(pin: string): boolean {
  for (let period = 1; period <= 3; period += 1) {
    if (pin.length % period !== 0 || pin.length / period < 2) continue;
    const block = pin.slice(0, period);
    if (block.repeat(pin.length / period) === pin) return true;
  }
  return false;
}

/** 6 dígitos con un año plausible al inicio o al final (ddmmaaaa, aaaammdd, …). */
function looksLikeYear(pin: string): boolean {
  const currentYear = new Date().getFullYear();
  for (const candidate of [pin.slice(0, 4), pin.slice(-4)]) {
    const year = Number(candidate);
    if (year >= 1930 && year <= currentYear) return true;
  }
  return false;
}

/**
 * Deriva el registro a partir de un PIN. `salt` se inyecta para poder probar
 * de forma determinista; en producción siempre proviene del CSPRNG del sistema
 * (ver `security/pinStore.ts`).
 */
export async function createPinRecord(
  pin: string,
  salt: Uint8Array,
  now = Date.now(),
): Promise<PinRecord> {
  if (salt.length < KDF_SALT_BYTES) {
    throw new RangeError(`La sal debe tener al menos ${KDF_SALT_BYTES} bytes`);
  }

  const hash = await deriveKey(pin, salt, KDF_ITERATIONS, KDF_KEY_BYTES);

  return {
    version: KDF_VERSION,
    saltHex: toHex(salt),
    hashHex: toHex(hash),
    iterations: KDF_ITERATIONS,
    createdAt: now,
  };
}

/**
 * Verifica un PIN contra su registro.
 *
 * Se derivan siempre las mismas iteraciones que se usaron al crear el registro
 * —no las actuales— para que subir `KDF_ITERATIONS` no invalide los PINs ya
 * configurados.
 */
export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  if (record.version !== KDF_VERSION) return false;

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromHex(record.saltHex);
    expected = fromHex(record.hashHex);
  } catch {
    // Registro corrupto: se rechaza en vez de dejar pasar por excepción.
    return false;
  }

  const candidate = await deriveKey(pin, salt, record.iterations, expected.length);
  return timingSafeEqual(candidate, expected);
}

/** El registro necesita regenerarse porque cambió el esquema de derivación. */
export function needsRehash(record: PinRecord): boolean {
  return record.version !== KDF_VERSION || record.iterations < KDF_ITERATIONS;
}
