import { describe, expect, it } from 'vitest';

import { DEFAULT_REWARD_POLICY, expiryWarningAt, type RewardPolicy } from '@/engine/economy';

/**
 * Aviso previo al fin del tiempo de ocio.
 *
 * La regla se prueba aquí y no se replica en Kotlin ni en Swift: el código
 * nativo recibe un instante ya calculado y se limita a programar la alarma.
 */

const AHORA = Date.UTC(2026, 7, 31, 12, 0, 0);
const MINUTO = 60_000;

const conAviso = (minutos: number): RewardPolicy => ({
  ...DEFAULT_REWARD_POLICY,
  expiryWarningMinutes: minutos,
});

describe('expiryWarningAt', () => {
  it('avisa con la antelación configurada', () => {
    const fin = AHORA + 30 * MINUTO;
    expect(expiryWarningAt(fin, conAviso(5), AHORA)).toBe(fin - 5 * MINUTO);
  });

  it('respeta una antelación distinta de la de por omisión', () => {
    const fin = AHORA + 60 * MINUTO;
    expect(expiryWarningAt(fin, conAviso(15), AHORA)).toBe(fin - 15 * MINUTO);
  });

  it('no avisa si no hay tiempo desbloqueado', () => {
    expect(expiryWarningAt(null, conAviso(5), AHORA)).toBeNull();
  });

  it('no avisa si el tutor desactivó el aviso', () => {
    expect(expiryWarningAt(AHORA + 30 * MINUTO, conAviso(0), AHORA)).toBeNull();
  });

  it('no avisa cuando el margen concedido es menor que la antelación', () => {
    // Tres minutos concedidos con un aviso de cinco: la notificación llegaría
    // en el mismo instante en que el menor acaba de ver su tiempo en pantalla.
    expect(expiryWarningAt(AHORA + 3 * MINUTO, conAviso(5), AHORA)).toBeNull();
  });

  it('no avisa sobre un tiempo que ya expiró', () => {
    expect(expiryWarningAt(AHORA - 10 * MINUTO, conAviso(5), AHORA)).toBeNull();
  });

  it('no avisa cuando el instante del aviso coincide exactamente con ahora', () => {
    // Programar una alarma para "ya" produce una notificación que llega tarde y
    // desordenada respecto al bloqueo; se prefiere omitirla.
    expect(expiryWarningAt(AHORA + 5 * MINUTO, conAviso(5), AHORA)).toBeNull();
  });

  it('el aviso siempre cae antes del fin del tiempo', () => {
    for (const minutos of [1, 5, 10, 15, 30]) {
      for (const restantes of [20, 45, 90, 180]) {
        const fin = AHORA + restantes * MINUTO;
        const aviso = expiryWarningAt(fin, conAviso(minutos), AHORA);
        if (aviso === null) continue;
        expect(aviso, `aviso ${minutos} min con ${restantes} min restantes`).toBeLessThan(fin);
        expect(aviso).toBeGreaterThan(AHORA);
      }
    }
  });

  it('la política por omisión trae el aviso activado', () => {
    expect(DEFAULT_REWARD_POLICY.expiryWarningMinutes).toBeGreaterThan(0);
  });
});
