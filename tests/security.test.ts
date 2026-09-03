import { beforeAll, describe, expect, it } from 'vitest';

import {
  KDF_ITERATIONS,
  createPinRecord,
  needsRehash,
  validatePinStrength,
  verifyPin,
  type PinRecord,
} from '@/security/pin';
import {
  INITIAL_LOCKOUT,
  evaluateLock,
  formatRemaining,
  registerFailure,
  registerSuccess,
} from '@/security/lockout';

/** Sal fija: los tests deben ser deterministas; producción usa el CSPRNG del sistema. */
const SALT = Uint8Array.from({ length: 16 }, (_, i) => i * 7 + 3);

// Derivar con 60 000 iteraciones cuesta cientos de milisegundos; se reutiliza
// un único registro en los casos que no dependen de crearlo de nuevo.
let record: PinRecord;

beforeAll(async () => {
  record = await createPinRecord('482913', SALT, 1_700_000_000_000);
});

describe('política de PIN', () => {
  it('acepta un PIN razonable', () => {
    expect(validatePinStrength('482913')).toEqual({ ok: true });
    expect(validatePinStrength('90418273')).toEqual({ ok: true });
  });

  it('exige entre 6 y 8 dígitos', () => {
    expect(validatePinStrength('12345').ok).toBe(false);
    expect(validatePinStrength('123456789').ok).toBe(false);
  });

  it('rechaza cualquier cosa que no sean dígitos', () => {
    expect(validatePinStrength('abc123').ok).toBe(false);
    expect(validatePinStrength('4829 13').ok).toBe(false);
    expect(validatePinStrength('').ok).toBe(false);
  });

  it('rechaza los PINs más usados del mundo', () => {
    for (const weak of ['123456', '000000', '111111', '121212', '654321']) {
      expect(validatePinStrength(weak).ok, weak).toBe(false);
    }
  });

  it('rechaza dígitos repetidos y secuencias monótonas', () => {
    expect(validatePinStrength('777777').ok).toBe(false);
    expect(validatePinStrength('345678').ok).toBe(false);
    expect(validatePinStrength('876543').ok).toBe(false);
  });

  it('rechaza patrones cortos repetidos', () => {
    expect(validatePinStrength('818181').ok).toBe(false);
    expect(validatePinStrength('492492').ok).toBe(false);
  });

  it('rechaza años de nacimiento plausibles', () => {
    expect(validatePinStrength('199045').ok).toBe(false);
    expect(validatePinStrength('150719').ok).toBe(true); // 1507 no es un año plausible
    expect(validatePinStrength('072004').ok).toBe(false);
  });

  it('cada rechazo trae un motivo legible', () => {
    const result = validatePinStrength('123456');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(10);
  });
});

describe('derivación y verificación del PIN', () => {
  it('nunca guarda el PIN en el registro', () => {
    expect(JSON.stringify(record)).not.toContain('482913');
  });

  it('acepta el PIN correcto y rechaza los demás', async () => {
    expect(await verifyPin('482913', record)).toBe(true);
    expect(await verifyPin('482914', record)).toBe(false);
    expect(await verifyPin('', record)).toBe(false);
    expect(await verifyPin('4829130', record)).toBe(false);
  });

  it('la misma sal y el mismo PIN producen el mismo derivado', async () => {
    expect((await createPinRecord('482913', SALT, 0)).hashHex).toBe(record.hashHex);
  });

  it('sales distintas producen derivados distintos para el mismo PIN', async () => {
    const otherSalt = Uint8Array.from({ length: 16 }, (_, i) => i + 200);
    expect((await createPinRecord('482913', otherSalt, 0)).hashHex).not.toBe(record.hashHex);
  });

  it('exige una sal de tamaño suficiente', async () => {
    await expect(createPinRecord('482913', Uint8Array.from([1, 2, 3]))).rejects.toThrow(RangeError);
  });

  it('rechaza un registro corrupto en vez de lanzar', async () => {
    const corrupted: PinRecord = { ...record, hashHex: 'no-es-hexadecimal' };
    expect(await verifyPin('482913', corrupted)).toBe(false);
  });

  it('rechaza un registro de una versión desconocida', async () => {
    expect(await verifyPin('482913', { ...record, version: 99 })).toBe(false);
  });

  it('detecta registros que necesitan regenerarse', () => {
    expect(needsRehash(record)).toBe(false);
    expect(needsRehash({ ...record, iterations: KDF_ITERATIONS - 1 })).toBe(true);
    expect(needsRehash({ ...record, version: 0 })).toBe(true);
  });
});

describe('bloqueo por intentos fallidos', () => {
  const t0 = 1_700_000_000_000;

  it('los primeros tres fallos no bloquean', () => {
    let state = INITIAL_LOCKOUT;
    for (let i = 0; i < 3; i += 1) state = registerFailure(state, t0);
    expect(evaluateLock(state, t0).locked).toBe(false);
    expect(evaluateLock(state, t0).attemptsBeforeDelay).toBe(0);
  });

  it('a partir del cuarto fallo la espera se duplica', () => {
    let state = INITIAL_LOCKOUT;
    for (let i = 0; i < 3; i += 1) state = registerFailure(state, t0);

    state = registerFailure(state, t0);
    expect(evaluateLock(state, t0).remainingMs).toBe(30_000);

    state = registerFailure(state, t0);
    expect(evaluateLock(state, t0).remainingMs).toBe(60_000);

    state = registerFailure(state, t0);
    expect(evaluateLock(state, t0).remainingMs).toBe(120_000);
  });

  it('la espera se acota en una hora', () => {
    let state = INITIAL_LOCKOUT;
    for (let i = 0; i < 40; i += 1) state = registerFailure(state, t0);
    expect(evaluateLock(state, t0).remainingMs).toBe(60 * 60 * 1000);
  });

  it('el bloqueo expira al pasar el tiempo', () => {
    let state = INITIAL_LOCKOUT;
    for (let i = 0; i < 4; i += 1) state = registerFailure(state, t0);

    expect(evaluateLock(state, t0 + 29_000).locked).toBe(true);
    expect(evaluateLock(state, t0 + 31_000).locked).toBe(false);
  });

  it('atrasar el reloj no adelanta el desbloqueo', () => {
    /**
     * Es el intento de evasión más accesible para un menor: cambiar la fecha
     * del teléfono. Si `now` es anterior al último fallo registrado, el estado
     * es imposible por construcción y se mantiene el bloqueo.
     */
    let state = INITIAL_LOCKOUT;
    for (let i = 0; i < 5; i += 1) state = registerFailure(state, t0);

    const status = evaluateLock(state, t0 - 10 * 60 * 60 * 1000);
    expect(status.locked).toBe(true);
    expect(status.remainingMs).toBe(60_000);
  });

  it('un acierto limpia todo el historial', () => {
    let state = INITIAL_LOCKOUT;
    for (let i = 0; i < 6; i += 1) state = registerFailure(state, t0);
    expect(evaluateLock(registerSuccess(), t0).locked).toBe(false);
    expect(registerSuccess().failedAttempts).toBe(0);
  });

  it('el estado sobrevive a un reinicio de la app', () => {
    // El estado es un objeto plano y serializable: reiniciar el proceso no
    // puede reiniciar el contador, que es justo lo que se busca.
    let state = INITIAL_LOCKOUT;
    for (let i = 0; i < 5; i += 1) state = registerFailure(state, t0);

    const restored = JSON.parse(JSON.stringify(state)) as typeof state;
    expect(evaluateLock(restored, t0 + 1000).locked).toBe(true);
  });

  it('formatea la espera de forma legible', () => {
    expect(formatRemaining(15_000)).toBe('15 s');
    expect(formatRemaining(90_000)).toBe('2 min');
    expect(formatRemaining(60 * 60 * 1000)).toBe('1 h');
    expect(formatRemaining(95 * 60 * 1000)).toBe('1 h 35 min');
  });
});
