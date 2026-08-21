import type { AgeBand } from './age';
import type { Pillar } from './pillar';

/**
 * Dificultad discreta 1..5. Es la unidad que ve la UI y el sistema de
 * recompensas; internamente el modelo de maestría trabaja en escala Elo
 * continua y se proyecta a este rango (ver engine/mastery.ts).
 */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3, 4, 5];

export function clampDifficulty(value: number): Difficulty {
  const rounded = Math.round(value);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded as Difficulty;
}

/** Token que se muestra durante la fase de memorización de un reto de memoria. */
export interface SequenceToken {
  /** Texto visible: un color, un símbolo, un dígito o una palabra. */
  readonly label: string;
  /** Color de acento opcional en formato hex, para retos cromáticos. */
  readonly color?: string;
}

interface PromptBase {
  /** Enunciado que se muestra junto a la respuesta. */
  readonly stem: string;
  /** Pista opcional; el motor la revela solo si el menor la solicita. */
  readonly hint?: string;
}

/** Reto de opción múltiple: la forma canónica del banco curado y de la mayoría de generadores. */
export interface MultipleChoicePrompt extends PromptBase {
  readonly kind: 'multiple_choice';
  readonly options: readonly string[];
  readonly correctIndex: number;
}

/**
 * Reto de memoria en dos fases: primero se muestra `sequence` durante
 * `studyMs`, después se oculta y se plantea `stem`.
 */
export interface SequenceRecallPrompt extends PromptBase {
  readonly kind: 'sequence_recall';
  readonly instruction: string;
  readonly sequence: readonly SequenceToken[];
  readonly studyMs: number;
  readonly options: readonly string[];
  readonly correctIndex: number;
}

/** Respuesta numérica libre; evita el azar del 25 % de la opción múltiple. */
export interface NumericEntryPrompt extends PromptBase {
  readonly kind: 'numeric_entry';
  readonly answer: number;
  /** Tolerancia absoluta admitida (0 para respuestas enteras exactas). */
  readonly tolerance: number;
  readonly unit?: string;
}

/**
 * Reto abierto de creatividad. No existe una respuesta correcta computable,
 * así que se califica por *esfuerzo* (extensión y riqueza léxica mínimas) y se
 * marca para revisión opcional del tutor en el panel. Nunca se envía a la nube.
 */
export interface OpenResponsePrompt extends PromptBase {
  readonly kind: 'open_response';
  readonly minChars: number;
  readonly minDistinctWords: number;
  readonly placeholder: string;
}

export type ExercisePrompt =
  | MultipleChoicePrompt
  | SequenceRecallPrompt
  | NumericEntryPrompt
  | OpenResponsePrompt;

export type ExerciseKind = ExercisePrompt['kind'];

/** Un reto listo para presentarse, ya sea generado o extraído del banco curado. */
export interface Exercise {
  /** Identidad de esta instancia concreta; única por generación. */
  readonly id: string;
  /** Origen: id del generador (`math.addition`) o del ítem curado (`bank:M01`). */
  readonly sourceId: string;
  readonly pillar: Pillar;
  readonly band: AgeBand;
  readonly difficulty: Difficulty;
  /**
   * Huella semántica estable del contenido. Dos instancias con la misma huella
   * plantean el mismo problema, aunque cambien el orden de las opciones o el id.
   * El planificador la usa para no repetir retos recientes.
   */
  readonly fingerprint: string;
  /** Segundos sugeridos para responder; `null` desactiva el cronómetro. */
  readonly timeLimitSec: number | null;
  readonly prompt: ExercisePrompt;
}

/** Lo que el menor respondió, en la forma que corresponde al tipo de reto. */
export type ExerciseResponse =
  | { readonly kind: 'choice'; readonly index: number }
  | { readonly kind: 'numeric'; readonly value: number }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'skipped' };

export type GradeOutcome = 'correct' | 'incorrect' | 'accepted' | 'skipped';

export interface Grade {
  readonly outcome: GradeOutcome;
  /** Puntuación 0..1. `accepted` (retos abiertos) siempre vale 1. */
  readonly score: number;
  /** Texto breve para la UI; nunca culpabiliza al menor. */
  readonly feedback: string;
  /** Respuesta esperada, para mostrar tras un fallo. Ausente en retos abiertos. */
  readonly expected?: string;
}

export interface Attempt {
  readonly exercise: Exercise;
  readonly response: ExerciseResponse;
  readonly grade: Grade;
  /** Milisegundos que tardó en responder, medidos en el cliente. */
  readonly elapsedMs: number;
  /** Si pidió la pista; reduce la recompensa pero no invalida el acierto. */
  readonly usedHint: boolean;
}
