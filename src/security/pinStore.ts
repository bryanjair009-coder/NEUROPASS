import { getRandomBytes } from 'expo-crypto';

import {
  INITIAL_LOCKOUT,
  evaluateLock,
  registerFailure,
  registerSuccess,
  type LockStatus,
  type LockoutState,
} from '@/security/lockout';
import {
  KDF_SALT_BYTES,
  createPinRecord,
  validatePinStrength,
  verifyPin,
  type PinRecord,
} from '@/security/pin';
import { secureStorage } from '@/security/secureStorage';

/**
 * Persistencia del PIN del tutor y de su estado de bloqueo.
 *
 * Todo vive en SecureStore, que respalda en Keychain (iOS) y en el Keystore de
 * Android: el material queda cifrado con una clave que no sale del hardware
 * seguro y solo es accesible con el dispositivo desbloqueado.
 *
 * El almacén concreto se resuelve en `secureStorage.ts`, que es lo único que
 * cambia entre plataformas. La derivación, el bloqueo y la política del PIN son
 * los mismos en todas.
 *
 * LÍMITE CONOCIDO, documentado a propósito en vez de disimulado: borrar los
 * datos de la app desde los ajustes de Android elimina también estas entradas.
 * Ningún almacenamiento a nivel de app puede impedirlo. La defensa contra ese
 * escenario es el Device Admin de Android —que permite prohibir la
 * desinstalación y el borrado de datos— y está en el módulo nativo. En iOS el
 * equivalente es el perfil MDM o Screen Time. Sin uno de esos dos, NEUROpass es
 * una barrera para un menor que no sabe dónde mirar, no un control forzoso.
 */

const KEY_PIN = 'neuropass.parent.pin.v1';
const KEY_LOCKOUT = 'neuropass.parent.lockout.v1';
const KEY_RECOVERY = 'neuropass.parent.recovery.v1';

/** Alfabeto Crockford sin I, L, O ni U: no se confunde al dictarlo o copiarlo. */
const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RECOVERY_LENGTH = 16;

export type UnlockResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'sin_pin' }
  | { readonly ok: false; readonly reason: 'bloqueado'; readonly status: LockStatus }
  | { readonly ok: false; readonly reason: 'incorrecto'; readonly status: LockStatus };

export async function hasPin(): Promise<boolean> {
  return (await secureStorage.getItem(KEY_PIN)) !== null;
}

/**
 * Configura el PIN por primera vez o lo cambia.
 *
 * Devuelve el código de recuperación **una sola vez**: es la única
 * oportunidad de anotarlo. No se guarda en claro en ningún sitio, solo su
 * derivado, exactamente igual que el PIN. Sin él, un tutor que olvide el PIN
 * pierde el acceso a la configuración de forma irrecuperable, y ese es un
 * escenario de soporte que se garantiza que ocurrirá.
 */
export async function setPin(pin: string): Promise<{ recoveryCode: string }> {
  const strength = validatePinStrength(pin);
  if (!strength.ok) throw new Error(strength.reason);

  const record = createPinRecord(pin, getRandomBytes(KDF_SALT_BYTES));
  const recoveryCode = generateRecoveryCode();
  const recoveryRecord = createPinRecord(recoveryCode, getRandomBytes(KDF_SALT_BYTES));

  await secureStorage.setItem(KEY_PIN, JSON.stringify(record));
  await secureStorage.setItem(KEY_RECOVERY, JSON.stringify(recoveryRecord));
  await saveLockout(INITIAL_LOCKOUT);

  return { recoveryCode };
}

/**
 * Verifica un PIN aplicando el bloqueo por intentos.
 *
 * El orden importa: primero se comprueba el bloqueo y solo después se deriva.
 * Al revés, cada intento seguiría costando la derivación PBKDF2 completa y el
 * bloqueo no ahorraría nada de trabajo al dispositivo.
 */
export async function unlock(pin: string, now = Date.now()): Promise<UnlockResult> {
  const record = await loadPinRecord();
  if (!record) return { ok: false, reason: 'sin_pin' };

  const lockout = await loadLockout();
  const status = evaluateLock(lockout, now);
  if (status.locked) return { ok: false, reason: 'bloqueado', status };

  if (verifyPin(pin, record)) {
    await saveLockout(registerSuccess());
    return { ok: true };
  }

  const next = registerFailure(lockout, now);
  await saveLockout(next);
  return { ok: false, reason: 'incorrecto', status: evaluateLock(next, now) };
}

/**
 * Restablece el PIN con el código de recuperación.
 *
 * El código también pasa por el bloqueo: si no, sería un segundo canal de
 * fuerza bruta sin límite, y con 16 caracteres tendría más entropía pero el
 * mismo problema estructural.
 */
export async function resetWithRecoveryCode(
  recoveryCode: string,
  newPin: string,
  now = Date.now(),
): Promise<{ ok: true; recoveryCode: string } | { ok: false; reason: string }> {
  const stored = await loadRecord(KEY_RECOVERY);
  if (!stored) return { ok: false, reason: 'No hay código de recuperación configurado.' };

  const lockout = await loadLockout();
  const status = evaluateLock(lockout, now);
  if (status.locked) return { ok: false, reason: 'Demasiados intentos. Espera antes de volver a probar.' };

  const normalized = normalizeRecoveryCode(recoveryCode);
  if (!verifyPin(normalized, stored)) {
    await saveLockout(registerFailure(lockout, now));
    return { ok: false, reason: 'El código de recuperación no coincide.' };
  }

  const strength = validatePinStrength(newPin);
  if (!strength.ok) return { ok: false, reason: strength.reason };

  // Rotar el código al usarlo: un código de un solo uso no puede reutilizarse
  // si alguien lo vio de reojo cuando el tutor lo escribió.
  return { ok: true, ...(await setPin(newPin)) };
}

export async function lockStatus(now = Date.now()): Promise<LockStatus> {
  return evaluateLock(await loadLockout(), now);
}

/** Borra el PIN y su estado. Solo desde el flujo de borrado total de datos. */
export async function clearPin(): Promise<void> {
  await secureStorage.removeItem(KEY_PIN);
  await secureStorage.removeItem(KEY_RECOVERY);
  await secureStorage.removeItem(KEY_LOCKOUT);
}

// ---------------------------------------------------------------------------

function generateRecoveryCode(): string {
  const bytes = getRandomBytes(RECOVERY_LENGTH);
  let code = '';
  for (let i = 0; i < RECOVERY_LENGTH; i += 1) {
    // El alfabeto tiene 32 símbolos, potencia de dos: tomar 5 bits no
    // introduce sesgo de módulo.
    code += RECOVERY_ALPHABET[(bytes[i] as number) & 0x1f];
  }
  return code;
}

/** Agrupa el código en bloques de cuatro para que sea legible al anotarlo. */
export function formatRecoveryCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? []).join('-');
}

/** Acepta el código con guiones, espacios o en minúsculas. */
function normalizeRecoveryCode(input: string): string {
  return input.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
}

async function loadPinRecord(): Promise<PinRecord | null> {
  return loadRecord(KEY_PIN);
}

async function loadRecord(key: string): Promise<PinRecord | null> {
  const raw = await secureStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PinRecord;
  } catch {
    return null;
  }
}

async function loadLockout(): Promise<LockoutState> {
  const raw = await secureStorage.getItem(KEY_LOCKOUT);
  if (!raw) return INITIAL_LOCKOUT;
  try {
    const parsed = JSON.parse(raw) as Partial<LockoutState>;
    return {
      failedAttempts: parsed.failedAttempts ?? 0,
      lockedUntil: parsed.lockedUntil ?? 0,
      lastFailureAt: parsed.lastFailureAt ?? 0,
    };
  } catch {
    // Estado ilegible: se asume lo más restrictivo que no rompe al tutor
    // legítimo, que es empezar de cero el contador.
    return INITIAL_LOCKOUT;
  }
}

async function saveLockout(state: LockoutState): Promise<void> {
  await secureStorage.setItem(KEY_LOCKOUT, JSON.stringify(state));
}

