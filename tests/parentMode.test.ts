import { describe, expect, it } from 'vitest';

import {
  frozenRemainingMs,
  isPauseActive,
  shiftOnPause,
  shiftOnResume,
  type ParentPause,
} from '@/engine/parentMode';

/**
 * Modo adulto.
 *
 * La propiedad que de verdad importa, y que gobierna todas estas pruebas: **el
 * menor termina la pausa con exactamente el mismo tiempo con el que la empezó**.
 * Ni un segundo menos, que sería injusto, ni uno más, que convertiría la pausa
 * en una forma de regalar tiempo.
 *
 * Se comprueba de extremo a extremo simulando el vencimiento de los permisos,
 * que es lo que la base de datos desplaza de verdad.
 */

const MINUTO = 60_000;
const T0 = Date.UTC(2026, 8, 15, 16, 0, 0);

/** Simula el ciclo completo y devuelve el tiempo restante tras reanudar. */
function restanteTrasPausa(opciones: {
  restanteInicialMin: number;
  duracionPausaMin: number | null;
  reanudaTrasMin: number;
}): number {
  const { restanteInicialMin, duracionPausaMin, reanudaTrasMin } = opciones;

  let unlockedUntil = T0 + restanteInicialMin * MINUTO;

  const pause: ParentPause = {
    pausedAt: T0,
    pausedUntil: duracionPausaMin === null ? null : T0 + duracionPausaMin * MINUTO,
  };

  unlockedUntil += shiftOnPause(pause);

  const reanudaEn = T0 + reanudaTrasMin * MINUTO;
  unlockedUntil += shiftOnResume(pause, reanudaEn);

  // Tras reanudar, lo que le queda al menor se mide desde el instante en que
  // recupera el teléfono. Si la pausa venció antes, cuenta desde el vencimiento.
  const desde = pause.pausedUntil === null ? reanudaEn : Math.min(reanudaEn, pause.pausedUntil);
  return (unlockedUntil - Math.max(desde, reanudaEn === desde ? desde : desde)) / MINUTO;
}

describe('el tiempo del menor se conserva durante la pausa', () => {
  it('pausa indefinida y reanudación manual', () => {
    expect(
      restanteTrasPausa({ restanteInicialMin: 90, duracionPausaMin: null, reanudaTrasMin: 25 }),
    ).toBe(90);
  });

  it('pausa con límite, el adulto termina antes', () => {
    expect(
      restanteTrasPausa({ restanteInicialMin: 90, duracionPausaMin: 30, reanudaTrasMin: 20 }),
    ).toBe(90);
  });

  it('pausa con límite, el adulto termina justo al vencer', () => {
    expect(
      restanteTrasPausa({ restanteInicialMin: 90, duracionPausaMin: 30, reanudaTrasMin: 30 }),
    ).toBe(90);
  });

  it('pausa con límite que nadie levanta: al vencer el tiempo ya es correcto', () => {
    // El caso que justifica adelantar el desplazamiento: si la app no vuelve a
    // abrirse, el vencimiento tiene que ser correcto por sí solo.
    const pause: ParentPause = { pausedAt: T0, pausedUntil: T0 + 30 * MINUTO };
    const unlockedUntil = T0 + 90 * MINUTO + shiftOnPause(pause);
    expect((unlockedUntil - (pause.pausedUntil as number)) / MINUTO).toBe(90);
  });

  it('se conserva para cualquier combinación de duración y momento de reanudación', () => {
    for (const restanteInicialMin of [5, 30, 90, 240]) {
      for (const duracionPausaMin of [15, 30, 60, 120, null]) {
        const tope = duracionPausaMin ?? 90;
        for (const reanudaTrasMin of [0, 1, Math.floor(tope / 2), tope]) {
          const resultado = restanteTrasPausa({
            restanteInicialMin,
            duracionPausaMin,
            reanudaTrasMin,
          });
          expect(
            resultado,
            `restante ${restanteInicialMin} · pausa ${duracionPausaMin} · reanuda a los ${reanudaTrasMin}`,
          ).toBe(restanteInicialMin);
        }
      }
    }
  });
});

describe('shiftOnResume', () => {
  it('no devuelve pausa que ya venció', () => {
    const pause: ParentPause = { pausedAt: T0, pausedUntil: T0 + 30 * MINUTO };
    // Reanudar diez minutos después del vencimiento no debe regalar tiempo.
    expect(shiftOnResume(pause, T0 + 40 * MINUTO)).toBe(0);
  });

  it('nunca resta tiempo en una pausa indefinida', () => {
    const pause: ParentPause = { pausedAt: T0, pausedUntil: null };
    expect(shiftOnResume(pause, T0 - 5 * MINUTO)).toBe(0);
  });
});

describe('isPauseActive', () => {
  it('sin pausa, nunca está activa', () => {
    expect(isPauseActive(null, T0)).toBe(false);
  });

  it('la indefinida sigue activa siempre', () => {
    expect(isPauseActive({ pausedAt: T0, pausedUntil: null }, T0 + 10_000 * MINUTO)).toBe(true);
  });

  it('la acotada deja de estarlo al vencer', () => {
    const pause: ParentPause = { pausedAt: T0, pausedUntil: T0 + 30 * MINUTO };
    expect(isPauseActive(pause, T0 + 29 * MINUTO)).toBe(true);
    expect(isPauseActive(pause, T0 + 30 * MINUTO)).toBe(false);
  });
});

describe('frozenRemainingMs', () => {
  it('muestra el tiempo que el menor recuperará, no el que marca el reloj', () => {
    const pause: ParentPause = { pausedAt: T0, pausedUntil: T0 + 30 * MINUTO };
    const unlockedUntil = T0 + 90 * MINUTO + shiftOnPause(pause);
    // A mitad de la pausa, el restante mostrado sigue siendo el original.
    expect(frozenRemainingMs(pause, unlockedUntil, T0 + 15 * MINUTO) / MINUTO).toBe(90);
  });

  it('sin tiempo desbloqueado devuelve cero', () => {
    expect(frozenRemainingMs({ pausedAt: T0, pausedUntil: null }, null, T0)).toBe(0);
  });
});
