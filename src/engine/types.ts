import type { AgeBand } from '@/domain/age';
import type { Difficulty, Exercise, ExercisePrompt } from '@/domain/exercise';
import type { Pillar } from '@/domain/pillar';
import type { Rng } from '@/lib/rng';

export interface GenerationContext {
  readonly rng: Rng;
  readonly band: AgeBand;
  readonly difficulty: Difficulty;
}

/**
 * Lo que produce un generador. El catálogo se encarga de completar identidad,
 * pilar, rango y dificultad, de modo que un generador solo describe el problema.
 */
export interface GeneratedExercise {
  readonly prompt: ExercisePrompt;
  /** Partes que identifican semánticamente el problema (sin el orden de opciones). */
  readonly fingerprintParts: readonly (string | number)[];
  readonly timeLimitSec?: number | null;
}

export interface ExerciseGenerator {
  /** Identificador estable, en notación de puntos: `matematicas.aritmetica`. */
  readonly id: string;
  /** Nombre legible para el panel del tutor. */
  readonly label: string;
  readonly pillar: Pillar;
  readonly bands: readonly AgeBand[];
  /** Rango de dificultad soportado, inclusivo. */
  readonly difficulty: readonly [Difficulty, Difficulty];
  generate(ctx: GenerationContext): GeneratedExercise;
}

/** Retos ya materializados por el catálogo, listos para la UI. */
export type MaterializedExercise = Exercise;
