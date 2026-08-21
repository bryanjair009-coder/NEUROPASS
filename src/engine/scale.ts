import { ageBandIndex, type AgeBand } from '@/domain/age';
import type { Difficulty } from '@/domain/exercise';

/**
 * Escalado compartido por los generadores. Vive en un solo lugar para que
 * "subir la dificultad" signifique lo mismo en los cinco pilares y para poder
 * recalibrar el juego entero tocando un archivo.
 */

/**
 * Segundos sugeridos para responder. Crece con la dificultad porque un reto
 * más duro exige más lectura, y decrece con la edad porque la velocidad de
 * procesamiento aumenta. Nunca es un castigo: agotar el tiempo cuenta como
 * omisión, no como error (ver grading.ts).
 */
export function timeLimitFor(band: AgeBand, difficulty: Difficulty): number {
  const base = [75, 60, 50][ageBandIndex(band)] as number;
  return base + (difficulty - 1) * 12;
}

/**
 * Milisegundos de exposición en la fase de memorización. La regla práctica en
 * pruebas de amplitud de memoria es ~1 s por elemento en primaria, bajando a
 * ~0.6 s en secundaria; se acorta un poco al subir la dificultad.
 */
export function studyMsFor(band: AgeBand, itemCount: number, difficulty: Difficulty): number {
  const perItem = [1100, 900, 700][ageBandIndex(band)] as number;
  const tighten = 1 - (difficulty - 1) * 0.08;
  return Math.round(itemCount * perItem * tighten);
}

/**
 * Interpola un entero dentro de un rango declarado por dificultad.
 * `ranges` debe tener 5 entradas, una por nivel.
 */
export function byDifficulty<T>(difficulty: Difficulty, ranges: readonly [T, T, T, T, T]): T {
  return ranges[difficulty - 1] as T;
}

/** Longitud de secuencia para retos de memoria, por rango y dificultad. */
export function spanFor(band: AgeBand, difficulty: Difficulty): number {
  const base = [3, 4, 5][ageBandIndex(band)] as number;
  return base + Math.floor((difficulty - 1) / 1.5);
}
