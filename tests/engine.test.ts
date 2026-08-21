import { describe, expect, it } from 'vitest';

import { AGE_BANDS, type AgeBand } from '@/domain/age';
import type { Difficulty, Exercise } from '@/domain/exercise';
import { PILLARS, type Pillar } from '@/domain/pillar';
import { bankItems } from '@/engine/bank';
import { materialize } from '@/engine/catalog';
import { arithmeticBasic, linearEquations, multiplicationDivision, percentages } from '@/engine/generators/math';
import { grade, masteryScoreOf } from '@/engine/grading';
import {
  INITIAL_MASTERY,
  expectedScore,
  initialMasteryByPillar,
  masteryPercent,
  ratingForDifficulty,
  targetDifficulty,
  updateMastery,
} from '@/engine/mastery';
import { planSession } from '@/engine/session';
import { Rng } from '@/lib/rng';

// ---------------------------------------------------------------------------
// Verificación aritmética
// ---------------------------------------------------------------------------

/** Extrae la respuesta correcta de un reto, sea de opción múltiple o de entrada libre. */
function answerOf(exercise: Exercise): string {
  const { prompt } = exercise;
  if (prompt.kind === 'numeric_entry') return String(prompt.answer);
  if (prompt.kind === 'multiple_choice' || prompt.kind === 'sequence_recall') {
    return prompt.options[prompt.correctIndex] as string;
  }
  throw new Error('El reto no tiene respuesta verificable');
}

describe('corrección matemática', () => {
  /**
   * Los tests de propiedad garantizan la *forma* del reto; estos garantizan el
   * *contenido*. Se vuelve a resolver el enunciado de forma independiente y se
   * compara con la respuesta que el generador marcó como correcta. Un error de
   * signo o de precedencia aquí se traduce en un menor castigado por dar la
   * respuesta buena, que es el peor defecto posible en esta app.
   */

  it('suma y resta coinciden con el enunciado', () => {
    for (const band of ['6-8', '9-12'] as const) {
      for (let difficulty = 1 as Difficulty; difficulty <= 5; difficulty = (difficulty + 1) as Difficulty) {
        for (let sample = 0; sample < 200; sample += 1) {
          const exercise = materialize(arithmeticBasic, band, difficulty, new Rng(`arit|${band}|${difficulty}|${sample}`), sample);
          const [expression] = exercise.prompt.stem.split(' = ');
          const terms = (expression as string).split(/ [+−] /).map(Number);
          const isSum = (expression as string).includes('+');
          const expected = isSum ? terms.reduce((a, b) => a + b, 0) : terms.reduce((a, b) => a - b);

          expect(Number(answerOf(exercise)), exercise.prompt.stem).toBe(expected);
          // Nunca se plantea una resta con resultado negativo a estas edades.
          if (!isSum) expect(expected, exercise.prompt.stem).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('multiplicación y división coinciden con el enunciado', () => {
    for (const band of ['9-12', '13-16'] as const) {
      for (let difficulty = 1 as Difficulty; difficulty <= 5; difficulty = (difficulty + 1) as Difficulty) {
        for (let sample = 0; sample < 200; sample += 1) {
          const exercise = materialize(multiplicationDivision, band, difficulty, new Rng(`md|${band}|${difficulty}|${sample}`), sample);
          const match = /^(\d+) ([×÷]) (\d+) = \?$/.exec(exercise.prompt.stem);
          expect(match, exercise.prompt.stem).not.toBeNull();

          const [, left, op, right] = match as RegExpExecArray;
          const expected = op === '×' ? Number(left) * Number(right) : Number(left) / Number(right);

          expect(Number.isInteger(expected), `división no exacta: ${exercise.prompt.stem}`).toBe(true);
          expect(Number(answerOf(exercise)), exercise.prompt.stem).toBe(expected);
        }
      }
    }
  });

  it('los porcentajes dan un resultado entero y correcto', () => {
    for (let difficulty = 1 as Difficulty; difficulty <= 5; difficulty = (difficulty + 1) as Difficulty) {
      for (let sample = 0; sample < 200; sample += 1) {
        const exercise = materialize(percentages, '13-16', difficulty, new Rng(`pct|${difficulty}|${sample}`), sample);
        const match = /el (\d+)% de (\d+)/.exec(exercise.prompt.stem);
        expect(match, exercise.prompt.stem).not.toBeNull();

        const [, percent, base] = match as RegExpExecArray;
        const expected = (Number(base) * Number(percent)) / 100;

        expect(Number.isInteger(expected), exercise.prompt.stem).toBe(true);
        expect(Number(answerOf(exercise)), exercise.prompt.stem).toBe(expected);
      }
    }
  });

  it('las ecuaciones lineales se satisfacen al sustituir la solución', () => {
    for (let difficulty = 1 as Difficulty; difficulty <= 5; difficulty = (difficulty + 1) as Difficulty) {
      for (let sample = 0; sample < 200; sample += 1) {
        const exercise = materialize(linearEquations, '13-16', difficulty, new Rng(`eq|${difficulty}|${sample}`), sample);
        const x = Number(answerOf(exercise));
        const equation = exercise.prompt.stem.replace('Resuelve para x:', '').trim();
        const [left, right] = equation.split('=').map((side) => evaluateLinear(side as string, x));

        expect(left, exercise.prompt.stem).toBeCloseTo(right as number, 9);
      }
    }
  });
});

/** Evalúa expresiones del tipo "3x + 7" o "− 5" sustituyendo x. */
function evaluateLinear(side: string, x: number): number {
  const normalized = side.replace(/−/g, '-').replace(/\s+/g, '');
  const terms = normalized.match(/[+-]?[^+-]+/g) ?? [];

  return terms.reduce((sum, term) => {
    if (!term.includes('x')) return sum + Number(term);
    const coefficient = term.replace('x', '');
    if (coefficient === '' || coefficient === '+') return sum + x;
    if (coefficient === '-') return sum - x;
    return sum + Number(coefficient) * x;
  }, 0);
}

// ---------------------------------------------------------------------------
// Modelo de maestría
// ---------------------------------------------------------------------------

describe('maestría adaptativa', () => {
  it('arranca en el equivalente a dificultad 2', () => {
    expect(targetDifficulty(INITIAL_MASTERY)).toBeGreaterThanOrEqual(1);
    expect(targetDifficulty(INITIAL_MASTERY)).toBeLessThanOrEqual(2);
  });

  it('la probabilidad esperada es 0.5 cuando el reto iguala al menor', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 10);
    expect(expectedScore(1400, 1000)).toBeGreaterThan(0.9);
    expect(expectedScore(600, 1000)).toBeLessThan(0.1);
  });

  it('sube con aciertos y baja con fallos', () => {
    const up = updateMastery(INITIAL_MASTERY, 3, 1);
    const down = updateMastery(INITIAL_MASTERY, 3, 0);
    expect(up.rating).toBeGreaterThan(INITIAL_MASTERY.rating);
    expect(down.rating).toBeLessThan(INITIAL_MASTERY.rating);
    expect(up.attempts).toBe(1);
  });

  it('ignora los retos abiertos, que no miden acierto', () => {
    expect(updateMastery(INITIAL_MASTERY, 3, null)).toEqual(INITIAL_MASTERY);
  });

  it('converge hacia la dificultad real del menor', () => {
    /**
     * Se simula un menor cuya habilidad verdadera equivale a dificultad 4 y se
     * responde según el propio modelo Elo. Tras 120 intentos, la dificultad
     * elegida debe haberse acercado a esa habilidad: es la propiedad que hace
     * útil todo el sistema.
     */
    const trueRating = ratingForDifficulty(4);
    const rng = new Rng('convergencia');
    let state = INITIAL_MASTERY;

    for (let i = 0; i < 120; i += 1) {
      const difficulty = targetDifficulty(state);
      const probability = expectedScore(trueRating, ratingForDifficulty(difficulty));
      state = updateMastery(state, difficulty, rng.bool(probability) ? 1 : 0);
    }

    expect(targetDifficulty(state)).toBeGreaterThanOrEqual(3);
    expect(Math.abs(state.rating - trueRating)).toBeLessThan(220);
  });

  it('mantiene la tasa de acierto cerca del objetivo del 75 %', () => {
    const trueRating = ratingForDifficulty(3);
    const rng = new Rng('tasa');
    let state = INITIAL_MASTERY;
    let hits = 0;
    const rounds = 400;
    const warmup = 100;

    for (let i = 0; i < rounds; i += 1) {
      const difficulty = targetDifficulty(state);
      const correct = rng.bool(expectedScore(trueRating, ratingForDifficulty(difficulty)));
      if (i >= warmup && correct) hits += 1;
      state = updateMastery(state, difficulty, correct ? 1 : 0);
    }

    const rate = hits / (rounds - warmup);
    expect(rate).toBeGreaterThan(0.6);
    expect(rate).toBeLessThan(0.92);
  });

  it('expresa el nivel como porcentaje acotado', () => {
    expect(masteryPercent({ rating: 0, attempts: 0 })).toBe(0);
    expect(masteryPercent({ rating: 99999, attempts: 0 })).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Calificación
// ---------------------------------------------------------------------------

describe('calificación', () => {
  const mcExercise = materialize(arithmeticBasic, '6-8', 1, new Rng('grading'), 0);

  it('acepta la opción correcta y rechaza el resto', () => {
    const prompt = mcExercise.prompt;
    if (prompt.kind !== 'multiple_choice') throw new Error('se esperaba opción múltiple');

    expect(grade(mcExercise, { kind: 'choice', index: prompt.correctIndex }).outcome).toBe('correct');

    const wrong = (prompt.correctIndex + 1) % prompt.options.length;
    const result = grade(mcExercise, { kind: 'choice', index: wrong });
    expect(result.outcome).toBe('incorrect');
    expect(result.expected).toBe(prompt.options[prompt.correctIndex]);
  });

  it('la omisión nunca cuenta como error y no mueve el rating', () => {
    const result = grade(mcExercise, { kind: 'skipped' });
    expect(result.outcome).toBe('skipped');
    expect(result.score).toBe(0);
    expect(masteryScoreOf(mcExercise, result)).toBeNull();
  });

  it('un reto abierto se acepta por esfuerzo, nunca se marca incorrecto', () => {
    const openExercise: Exercise = {
      ...mcExercise,
      prompt: {
        kind: 'open_response',
        stem: 'Inventa algo.',
        placeholder: '...',
        minChars: 20,
        minDistinctWords: 4,
      },
    };

    const short = grade(openExercise, { kind: 'text', value: 'nada' });
    expect(short.outcome).toBe('skipped');

    const enough = grade(openExercise, {
      kind: 'text',
      value: 'Una nave hecha con cajas viejas para viajar al patio',
    });
    expect(enough.outcome).toBe('accepted');
    expect(masteryScoreOf(openExercise, enough)).toBeNull();
  });

  it('la entrada numérica respeta la tolerancia declarada', () => {
    const numeric: Exercise = {
      ...mcExercise,
      prompt: { kind: 'numeric_entry', stem: '¿?', answer: 42, tolerance: 0 },
    };
    expect(grade(numeric, { kind: 'numeric', value: 42 }).outcome).toBe('correct');
    expect(grade(numeric, { kind: 'numeric', value: 43 }).outcome).toBe('incorrect');
    expect(grade(numeric, { kind: 'numeric', value: Number.NaN }).outcome).toBe('skipped');
  });
});

// ---------------------------------------------------------------------------
// Planificador de sesiones
// ---------------------------------------------------------------------------

describe('planificador de sesiones', () => {
  const baseInput = (band: AgeBand, size: number) => ({
    band,
    seed: `sesion|${band}|${size}`,
    size,
    mastery: initialMasteryByPillar(),
  });

  it('respeta el tamaño pedido en los tres rangos', () => {
    for (const band of AGE_BANDS) {
      for (const size of [1, 3, 5, 8, 12]) {
        const plan = planSession(baseInput(band, size));
        expect(plan.exercises.length, `${band} · ${size}`).toBe(size);
      }
    }
  });

  it('cubre los cinco pilares cuando la sesión tiene al menos cinco retos', () => {
    for (const band of AGE_BANDS) {
      const plan = planSession(baseInput(band, 5));
      const pillars = new Set(plan.exercises.map((e) => e.pillar));
      expect(pillars.size, `${band}: ${[...pillars].join(', ')}`).toBe(PILLARS.length);
    }
  });

  it('respeta los pilares que el tutor habilitó', () => {
    const focus: Pillar[] = ['matematicas', 'logica'];
    const plan = planSession({ ...baseInput('9-12', 6), focusPillars: focus });
    for (const exercise of plan.exercises) {
      expect(focus).toContain(exercise.pillar);
    }
  });

  it('no incluye más de un reto de respuesta escrita por sesión', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const plan = planSession({ ...baseInput('13-16', 8), seed: `abierto|${seed}` });
      const open = plan.exercises.filter((e) => e.prompt.kind === 'open_response');
      expect(open.length, `semilla ${seed}`).toBeLessThanOrEqual(1);
    }
  });

  it('omite los retos escritos cuando el tutor los deshabilita', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const plan = planSession({
        ...baseInput('13-16', 8),
        seed: `sin-abierto|${seed}`,
        allowOpenResponse: false,
      });
      expect(plan.exercises.some((e) => e.prompt.kind === 'open_response')).toBe(false);
    }
  });

  it('no repite retos dentro de una misma sesión', () => {
    for (const band of AGE_BANDS) {
      for (let seed = 0; seed < 30; seed += 1) {
        const plan = planSession({ ...baseInput(band, 10), seed: `unicos|${band}|${seed}` });
        const fingerprints = plan.exercises.map((e) => e.fingerprint);
        expect(new Set(fingerprints).size, `${band} · semilla ${seed}`).toBe(fingerprints.length);
      }
    }
  });

  it('mantiene baja la repetición a lo largo de 30 sesiones seguidas', () => {
    /**
     * Es la propiedad que justifica el motor procedural: un menor que juega
     * seis sesiones diarias durante cinco días no debería reencontrarse con
     * los mismos retos. Se arrastra el historial completo entre sesiones, tal
     * como hace la app.
     */
    for (const band of AGE_BANDS) {
      const history: string[] = [];
      let repeated = 0;

      for (let session = 0; session < 30; session += 1) {
        const plan = planSession({
          band,
          seed: `serie|${band}|${session}`,
          size: 5,
          mastery: initialMasteryByPillar(),
          recentFingerprints: history,
        });

        for (const exercise of plan.exercises) {
          if (history.includes(exercise.fingerprint)) repeated += 1;
          history.push(exercise.fingerprint);
        }
      }

      const rate = repeated / history.length;
      expect(rate, `${band}: ${(rate * 100).toFixed(1)} % de repetición`).toBeLessThan(0.15);
    }
  });

  it('es determinista respecto a la semilla', () => {
    const input = baseInput('9-12', 7);
    expect(planSession(input)).toEqual(planSession(input));
  });

  it('sube la dificultad cuando el modelo de maestría sube', () => {
    const strong = initialMasteryByPillar();
    const boosted = Object.fromEntries(
      PILLARS.map((pillar) => [pillar, { rating: ratingForDifficulty(5) + 200, attempts: 50 }]),
    ) as typeof strong;

    const easy = planSession({ ...baseInput('13-16', 10), mastery: strong });
    const hard = planSession({ ...baseInput('13-16', 10), mastery: boosted });

    const average = (plan: { exercises: readonly Exercise[] }): number =>
      plan.exercises.reduce((sum, e) => sum + e.difficulty, 0) / plan.exercises.length;

    expect(average(hard)).toBeGreaterThan(average(easy));
  });

  it('rechaza sesiones vacías', () => {
    expect(() => planSession(baseInput('6-8', 0))).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Banco curado
// ---------------------------------------------------------------------------

describe('banco curado', () => {
  it('carga y valida los 100 ítems', () => {
    const items = bankItems();
    expect(items.length).toBe(100);
    for (const item of items) {
      expect(item.options[item.correctIndex]).toBeTruthy();
      expect(new Set(item.options.map((o) => o.trim().toLowerCase())).size).toBe(item.options.length);
    }
  });

  it('cubre los cinco pilares', () => {
    const byPillar = new Set(bankItems().map((i) => i.pillar));
    expect(byPillar.size).toBe(PILLARS.length);
  });
});
