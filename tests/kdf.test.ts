import { afterEach, describe, expect, it, vi } from 'vitest';

import { toHex } from '@/lib/crypto/sha256';
import { deriveKey, kdfIsAccelerated, registerKdfAccelerator } from '@/security/kdf';

/**
 * Aceleración de la derivación del PIN.
 *
 * Lo que se prueba aquí no es la velocidad sino la salvaguarda: delegar la
 * derivación en la implementación del sistema solo es aceptable si produce
 * exactamente los mismos bytes. Si no, los PIN ya configurados dejarían de
 * verificar y el tutor quedaría fuera de su propio panel, sin más recurso que
 * el código de recuperación.
 *
 * Por eso todos estos casos comprueban lo mismo desde ángulos distintos: pase
 * lo que pase con el acelerador, el resultado de `deriveKey` es idéntico al de
 * la implementación en JavaScript, que es la verificada contra los vectores
 * oficiales.
 */

const SALT = Uint8Array.from({ length: 16 }, (_, i) => i);
const PIN = '482913';
const ITERACIONES = 500;
const BYTES = 32;

/** Resultado de referencia: sin acelerador registrado se usa JavaScript. */
async function referencia(): Promise<string> {
  registerKdfAccelerator(null);
  return toHex(await deriveKey(PIN, SALT, ITERACIONES, BYTES));
}

afterEach(() => {
  registerKdfAccelerator(null);
});

describe('deriveKey', () => {
  it('sin acelerador usa la implementación en JavaScript', async () => {
    registerKdfAccelerator(null);
    expect(await kdfIsAccelerated()).toBe(false);
    expect(toHex(await deriveKey(PIN, SALT, ITERACIONES, BYTES))).toHaveLength(BYTES * 2);
  });

  it('usa el acelerador cuando reproduce el vector de control', async () => {
    const esperado = await referencia();

    // Un acelerador fiel: delega en la misma implementación de referencia.
    const fiel = vi.fn(async (password: string, saltHex: string, iterations: number, keyBytes: number) => {
      const { pbkdf2Sha256, utf8Bytes, fromHex } = await import('@/lib/crypto/sha256');
      return toHex(pbkdf2Sha256(utf8Bytes(password), fromHex(saltHex), iterations, keyBytes));
    });

    registerKdfAccelerator(fiel);

    expect(await kdfIsAccelerated()).toBe(true);
    expect(toHex(await deriveKey(PIN, SALT, ITERACIONES, BYTES))).toBe(esperado);
    expect(fiel).toHaveBeenCalled();
  });

  it('descarta un acelerador que produce bytes distintos', async () => {
    const esperado = await referencia();

    // El caso peligroso: una implementación que funciona pero no es compatible.
    const impostor = vi.fn(async () => 'ff'.repeat(BYTES));
    registerKdfAccelerator(impostor);

    expect(await kdfIsAccelerated()).toBe(false);
    expect(toHex(await deriveKey(PIN, SALT, ITERACIONES, BYTES))).toBe(esperado);
  });

  it('descarta un acelerador que falla', async () => {
    const esperado = await referencia();

    const roto = vi.fn(async () => {
      throw new Error('sin implementación nativa');
    });
    registerKdfAccelerator(roto);

    expect(await kdfIsAccelerated()).toBe(false);
    expect(toHex(await deriveKey(PIN, SALT, ITERACIONES, BYTES))).toBe(esperado);
  });

  it('la autocomprobación se hace una sola vez', async () => {
    const fiel = vi.fn(async (password: string, saltHex: string, iterations: number, keyBytes: number) => {
      const { pbkdf2Sha256, utf8Bytes, fromHex } = await import('@/lib/crypto/sha256');
      return toHex(pbkdf2Sha256(utf8Bytes(password), fromHex(saltHex), iterations, keyBytes));
    });
    registerKdfAccelerator(fiel);

    await kdfIsAccelerated();
    await kdfIsAccelerated();
    await deriveKey(PIN, SALT, ITERACIONES, BYTES);

    // Una llamada de comprobación más la derivación real: si la comprobación se
    // repitiera, cada verificación de PIN costaría el doble.
    expect(fiel).toHaveBeenCalledTimes(2);
  });
});
