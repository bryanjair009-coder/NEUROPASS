import type { Exercise, ExerciseResponse, Grade } from '@/domain/exercise';

/**
 * Calificación de un intento.
 *
 * Regla de producto que atraviesa todo el archivo: **el tono nunca culpa al
 * menor**. NEUROpass condiciona el tiempo de ocio al esfuerzo cognitivo, así
 * que ya es un contexto con presión; añadirle vergüenza es contraproducente y
 * a estas edades es directamente dañino. Un fallo se comunica como información
 * ("la respuesta era X"), jamás como juicio.
 */

const ENCOURAGEMENT = {
  correct: ['¡Exacto!', '¡Muy bien!', '¡Correcto!', '¡Lo lograste!'],
  incorrect: ['Casi. Esta se guarda para la próxima.', 'No era esa, pero ya la conoces.', 'Buen intento.'],
} as const;

/** Elige de forma determinista para que reintentar el mismo reto no cambie el texto. */
function encourage(kind: keyof typeof ENCOURAGEMENT, seed: string): string {
  const options = ENCOURAGEMENT[kind];
  let sum = 0;
  for (let i = 0; i < seed.length; i += 1) sum = (sum + seed.charCodeAt(i)) % 997;
  return options[sum % options.length] as string;
}

/** Palabras distintas de una respuesta abierta, normalizadas y sin signos. */
export function distinctWords(text: string): number {
  const words = text
    .toLocaleLowerCase('es')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1);
  return new Set(words).size;
}

export function grade(exercise: Exercise, response: ExerciseResponse): Grade {
  const { prompt } = exercise;

  if (response.kind === 'skipped') {
    return {
      outcome: 'skipped',
      score: 0,
      feedback: 'Sin responder. No pasa nada, sigue la siguiente.',
      ...(expectedAnswerOf(exercise) ? { expected: expectedAnswerOf(exercise) as string } : {}),
    };
  }

  switch (prompt.kind) {
    case 'multiple_choice':
    case 'sequence_recall': {
      if (response.kind !== 'choice') return mismatch(exercise);
      const isCorrect = response.index === prompt.correctIndex;
      const expected = prompt.options[prompt.correctIndex] as string;
      return isCorrect
        ? { outcome: 'correct', score: 1, feedback: encourage('correct', exercise.fingerprint) }
        : {
            outcome: 'incorrect',
            score: 0,
            feedback: encourage('incorrect', exercise.fingerprint),
            expected,
          };
    }

    case 'numeric_entry': {
      if (response.kind !== 'numeric') return mismatch(exercise);
      if (!Number.isFinite(response.value)) return mismatch(exercise);
      const isCorrect = Math.abs(response.value - prompt.answer) <= prompt.tolerance;
      return isCorrect
        ? { outcome: 'correct', score: 1, feedback: encourage('correct', exercise.fingerprint) }
        : {
            outcome: 'incorrect',
            score: 0,
            feedback: encourage('incorrect', exercise.fingerprint),
            expected: String(prompt.answer),
          };
    }

    case 'open_response': {
      if (response.kind !== 'text') return mismatch(exercise);
      const text = response.value.trim();
      const meetsThreshold =
        text.length >= prompt.minChars && distinctWords(text) >= prompt.minDistinctWords;

      // No existe "incorrecto" en un reto divergente: o hay trabajo, o no lo hay.
      return meetsThreshold
        ? { outcome: 'accepted', score: 1, feedback: '¡Gran idea! Quedó guardada para que la veas después.' }
        : {
            outcome: 'skipped',
            score: 0,
            feedback: `Desarrolla un poco más tu idea: al menos ${prompt.minChars} caracteres y ${prompt.minDistinctWords} palabras distintas.`,
          };
    }
  }
}

/**
 * Una respuesta de tipo incompatible con el reto solo puede venir de un error
 * de programación. Se degrada a omisión —el menor no pierde nada— pero se
 * registra para que salga en desarrollo.
 */
function mismatch(exercise: Exercise): Grade {
  // `__DEV__` solo existe en el runtime de React Native; el motor también corre
  // bajo Node en los tests, así que se consulta con guarda.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[grading] Respuesta incompatible con el reto ${exercise.sourceId} (${exercise.prompt.kind})`);
  }
  return { outcome: 'skipped', score: 0, feedback: 'No se pudo registrar la respuesta.' };
}

/** Respuesta esperada en texto, o `null` si el reto no tiene una. */
export function expectedAnswerOf(exercise: Exercise): string | null {
  const { prompt } = exercise;
  switch (prompt.kind) {
    case 'multiple_choice':
    case 'sequence_recall':
      return (prompt.options[prompt.correctIndex] as string) ?? null;
    case 'numeric_entry':
      return String(prompt.answer);
    case 'open_response':
      return null;
  }
}

/**
 * Puntuación que alimenta al modelo de maestría. Los retos abiertos devuelven
 * `null` porque no miden acierto y contaminarían el rating.
 */
export function masteryScoreOf(exercise: Exercise, grade: Grade): number | null {
  if (exercise.prompt.kind === 'open_response') return null;
  if (grade.outcome === 'skipped') return null;
  return grade.score;
}
