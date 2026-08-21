import { clampDifficulty, type Difficulty } from '@/domain/exercise';
import { PILLARS, type Pillar } from '@/domain/pillar';

/**
 * Modelo de maestría adaptativa, uno por pilar.
 *
 * Se usa Elo en vez de una simple racha de aciertos por tres razones:
 *  - Un acierto en dificultad 5 vale mucho más que uno en dificultad 1, y Elo
 *    lo pondera solo con la diferencia de rating, sin reglas ad hoc.
 *  - Converge rápido con pocos datos (K alto al inicio) y luego se estabiliza,
 *    que es exactamente el comportamiento deseable con un menor que juega
 *    sesiones cortas.
 *  - Es un número interpretable: se puede graficar en el panel del tutor como
 *    "nivel" sin exponer nada sobre el contenido de las respuestas.
 *
 * El rating es *relativo al rango de edad*: un 1000 en 6-8 no es comparable con
 * un 1000 en 13-16, porque la dificultad 3 significa cosas distintas en cada
 * rango. Nunca se comparan menores entre sí, ni dentro del dispositivo.
 */

export interface MasteryState {
  /** Rating Elo del menor en este pilar. */
  readonly rating: number;
  /** Intentos calificables acumulados; controla la velocidad de ajuste. */
  readonly attempts: number;
}

/** Rating equivalente a cada nivel de dificultad. */
const RATING_AT_DIFFICULTY_1 = 700;
const RATING_PER_DIFFICULTY = 150;

/**
 * Tasa de acierto objetivo al elegir la dificultad. 0.75 está dentro de la
 * "zona de dificultad deseable": suficientemente alta para sostener la
 * motivación de un menor, suficientemente baja para que haya aprendizaje real.
 */
const TARGET_SUCCESS_RATE = 0.75;

/** Se arranca en el equivalente a dificultad 2: cómodo, pero no trivial. */
export const INITIAL_MASTERY: MasteryState = {
  rating: RATING_AT_DIFFICULTY_1 + RATING_PER_DIFFICULTY,
  attempts: 0,
};

export function initialMasteryByPillar(): Record<Pillar, MasteryState> {
  return Object.fromEntries(PILLARS.map((pillar) => [pillar, INITIAL_MASTERY])) as Record<
    Pillar,
    MasteryState
  >;
}

export function ratingForDifficulty(difficulty: Difficulty): number {
  return RATING_AT_DIFFICULTY_1 + (difficulty - 1) * RATING_PER_DIFFICULTY;
}

/** Probabilidad de acierto según la diferencia de rating (curva logística Elo). */
export function expectedScore(rating: number, itemRating: number): number {
  return 1 / (1 + 10 ** ((itemRating - rating) / 400));
}

/**
 * Factor K decreciente: los primeros intentos mueven mucho el rating para
 * calibrar rápido, y después se estabiliza para que un mal día no borre meses
 * de progreso.
 */
function kFactor(attempts: number): number {
  if (attempts < 10) return 48;
  if (attempts < 30) return 28;
  return 16;
}

/**
 * Actualiza la maestría con un intento. `score` es 0..1; para retos abiertos,
 * que no miden acierto, se debe pasar `null` y el estado no cambia.
 */
export function updateMastery(
  state: MasteryState,
  difficulty: Difficulty,
  score: number | null,
): MasteryState {
  if (score === null) return state;

  const itemRating = ratingForDifficulty(difficulty);
  const expected = expectedScore(state.rating, itemRating);
  const delta = kFactor(state.attempts) * (score - expected);

  return {
    // Se acota por abajo para que el rating no colapse a valores sin sentido
    // tras una racha mala, y por arriba porque más de dificultad 5 no existe.
    rating: Math.min(RATING_AT_DIFFICULTY_1 + RATING_PER_DIFFICULTY * 5.5, Math.max(400, state.rating + delta)),
    attempts: state.attempts + 1,
  };
}

/**
 * Dificultad que sitúa al menor en la tasa de acierto objetivo.
 *
 * Se despeja el rating de ítem `b` tal que P(acierto) = TARGET_SUCCESS_RATE:
 *   b = rating − 400·log10( p / (1 − p) )
 */
export function targetDifficulty(state: MasteryState): Difficulty {
  const offset = 400 * Math.log10(TARGET_SUCCESS_RATE / (1 - TARGET_SUCCESS_RATE));
  const itemRating = state.rating - offset;
  return clampDifficulty((itemRating - RATING_AT_DIFFICULTY_1) / RATING_PER_DIFFICULTY + 1);
}

/** Nivel 0..100 para mostrar en el panel; monótono con el rating. */
export function masteryPercent(state: MasteryState): number {
  const min = RATING_AT_DIFFICULTY_1;
  const max = RATING_AT_DIFFICULTY_1 + RATING_PER_DIFFICULTY * 5;
  return Math.round(Math.min(100, Math.max(0, ((state.rating - min) / (max - min)) * 100)));
}

/**
 * Pilar más rezagado, para que el planificador le dé prioridad.
 * Con pocos intentos (< 5) se considera indeterminado y devuelve `null`, para
 * no perseguir ruido antes de que el modelo se haya calibrado.
 */
export function weakestPillar(mastery: Record<Pillar, MasteryState>): Pillar | null {
  const calibrated = PILLARS.filter((pillar) => (mastery[pillar]?.attempts ?? 0) >= 5);
  if (calibrated.length === 0) return null;

  return calibrated.reduce((weakest, pillar) =>
    (mastery[pillar] as MasteryState).rating < (mastery[weakest] as MasteryState).rating ? pillar : weakest,
  );
}
