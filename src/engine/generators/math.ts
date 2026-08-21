import type { AgeBand } from '@/domain/age';
import type { Difficulty } from '@/domain/exercise';
import { buildChoices, numericChoices, numericDistractors } from '@/engine/choices';
import { byDifficulty, timeLimitFor } from '@/engine/scale';
import type { ExerciseGenerator, GeneratedExercise, GenerationContext } from '@/engine/types';
import type { Rng } from '@/lib/rng';

/**
 * Pilar 1 — Matemáticas rápida.
 *
 * Dos decisiones de diseño transversales a todo el pilar:
 *
 *  1. A partir de dificultad 4, los retos con respuesta entera pasan a entrada
 *     numérica libre. La opción múltiple regala un 25 % de acierto por azar, lo
 *     que corrompe tanto el modelo de maestría como la recompensa de tiempo.
 *  2. Los distractores nunca son ruido: son el resultado de errores reales
 *     (fuera por uno, invertir la resta, sumar en vez de multiplicar), para que
 *     equivocarse signifique algo diagnosticable.
 */

const NAMES = ['Sofía', 'Mateo', 'Valeria', 'Diego', 'Ximena', 'Emiliano', 'Renata', 'Iker'] as const;
const ITEMS = ['canicas', 'estampas', 'lápices', 'galletas', 'monedas', 'calcomanías'] as const;

/** A partir de este nivel se exige escribir la respuesta en vez de elegirla. */
const FREE_ENTRY_FROM: Difficulty = 4;

function integerAnswer(
  ctx: GenerationContext,
  stem: string,
  answer: number,
  fingerprintParts: readonly (string | number)[],
  hint?: string,
): GeneratedExercise {
  const timeLimitSec = timeLimitFor(ctx.band, ctx.difficulty);

  if (ctx.difficulty >= FREE_ENTRY_FROM) {
    return {
      prompt: { kind: 'numeric_entry', stem, answer, tolerance: 0, ...(hint ? { hint } : {}) },
      fingerprintParts,
      timeLimitSec,
    };
  }

  return {
    prompt: {
      kind: 'multiple_choice',
      stem,
      ...numericChoices(ctx.rng, answer),
      ...(hint ? { hint } : {}),
    },
    fingerprintParts,
    timeLimitSec,
  };
}

// ---------------------------------------------------------------------------
// Aritmética básica: suma y resta
// ---------------------------------------------------------------------------

export const arithmeticBasic: ExerciseGenerator = {
  id: 'matematicas.aritmetica',
  label: 'Suma y resta',
  pillar: 'matematicas',
  bands: ['6-8', '9-12'],
  difficulty: [1, 5],
  generate(ctx) {
    const max = byDifficulty(ctx.difficulty, [10, 20, 50, 99, 199]);
    const termCount = ctx.difficulty >= 4 ? 3 : 2;
    const isSum = ctx.rng.bool(0.55);

    let values: number[];
    let answer: number;

    if (isSum) {
      values = Array.from({ length: termCount }, () => ctx.rng.int(1, max));
      answer = values.reduce((a, b) => a + b, 0);
    } else {
      // La resta se construye *desde el resultado*: se eligen los sustraendos y
      // el minuendo se calcula para que el resultado nunca sea negativo. Ordenar
      // de mayor a menor no basta con tres términos (66 − 62 − 18 < 0), y los
      // números negativos no corresponden a estos rangos de edad.
      const subtrahends = Array.from({ length: termCount - 1 }, () => ctx.rng.int(1, max));
      answer = ctx.rng.int(0, max);
      values = [subtrahends.reduce((a, b) => a + b, answer), ...subtrahends];
    }

    const stem = values.join(isSum ? ' + ' : ' − ') + ' = ?';

    return integerAnswer(ctx, stem, answer, ['aritmetica', isSum ? '+' : '-', ...values]);
  },
};

// ---------------------------------------------------------------------------
// Comparación de cantidades
// ---------------------------------------------------------------------------

export const quantityComparison: ExerciseGenerator = {
  id: 'matematicas.comparacion',
  label: 'Comparar cantidades',
  pillar: 'matematicas',
  bands: ['6-8'],
  difficulty: [1, 3],
  generate(ctx) {
    const max = byDifficulty(ctx.difficulty, [20, 60, 150, 150, 150]);
    const pool = new Set<number>();
    while (pool.size < 4) pool.add(ctx.rng.int(1, max));
    const values = [...pool];

    const wantLargest = ctx.rng.bool();
    const answer = wantLargest ? Math.max(...values) : Math.min(...values);
    const options = ctx.rng.shuffle(values.map(String));

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: wantLargest ? '¿Cuál número es mayor?' : '¿Cuál número es menor?',
        options,
        correctIndex: options.indexOf(String(answer)),
      },
      fingerprintParts: ['comparacion', wantLargest ? 'max' : 'min', ...values.slice().sort((a, b) => a - b)],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Series numéricas
// ---------------------------------------------------------------------------

type SeriesKind = 'aritmetica' | 'geometrica' | 'cuadrados' | 'alternada';

export const numberSeries: ExerciseGenerator = {
  id: 'matematicas.serie',
  label: 'Series numéricas',
  pillar: 'matematicas',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const kinds = availableSeriesKinds(ctx.band, ctx.difficulty);
    const kind = ctx.rng.pick(kinds);
    const { terms, next, rule } = buildSeries(ctx.rng, kind, ctx.difficulty);
    const stem = `¿Qué número sigue?\n${terms.join(', ')}, ___`;

    return integerAnswer(ctx, stem, next, ['serie', kind, ...terms], rule);
  },
};

function availableSeriesKinds(band: AgeBand, difficulty: Difficulty): SeriesKind[] {
  if (band === '6-8') return ['aritmetica'];
  if (band === '9-12') return difficulty >= 3 ? ['aritmetica', 'geometrica', 'cuadrados'] : ['aritmetica', 'geometrica'];
  return ['aritmetica', 'geometrica', 'cuadrados', 'alternada'];
}

function buildSeries(
  rng: Rng,
  kind: SeriesKind,
  difficulty: Difficulty,
): { terms: number[]; next: number; rule: string } {
  const length = 4;

  switch (kind) {
    case 'aritmetica': {
      const step = rng.int(2, byDifficulty(difficulty, [3, 5, 9, 12, 17]));
      const start = rng.int(1, 15);
      const terms = Array.from({ length }, (_, i) => start + step * i);
      return { terms, next: start + step * length, rule: 'Cada número aumenta la misma cantidad.' };
    }
    case 'geometrica': {
      const ratio = rng.int(2, difficulty >= 4 ? 4 : 3);
      const start = rng.int(1, 5);
      const terms = Array.from({ length }, (_, i) => start * ratio ** i);
      return { terms, next: start * ratio ** length, rule: 'Cada número se multiplica por el mismo factor.' };
    }
    case 'cuadrados': {
      const start = rng.int(1, 6);
      const terms = Array.from({ length }, (_, i) => (start + i) ** 2);
      return { terms, next: (start + length) ** 2, rule: 'Son números elevados al cuadrado.' };
    }
    case 'alternada': {
      // Dos progresiones intercaladas: exige separar la serie antes de resolverla.
      const a0 = rng.int(1, 12);
      const b0 = rng.int(20, 40);
      const stepA = rng.int(2, 7);
      const stepB = -rng.int(2, 6);
      const terms = [a0, b0, a0 + stepA, b0 + stepB];
      return { terms, next: a0 + stepA * 2, rule: 'Hay dos series intercaladas: una en posiciones pares y otra en impares.' };
    }
  }
}

// ---------------------------------------------------------------------------
// Multiplicación y división
// ---------------------------------------------------------------------------

export const multiplicationDivision: ExerciseGenerator = {
  id: 'matematicas.multiplicacion',
  label: 'Multiplicación y división',
  pillar: 'matematicas',
  bands: ['9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const max = byDifficulty(ctx.difficulty, [9, 12, 15, 25, 40]);
    const a = ctx.rng.int(2, max);
    const b = ctx.rng.int(2, Math.min(12, max));
    const asDivision = ctx.rng.bool(0.45);

    // La división se construye desde el producto para que siempre sea exacta.
    const stem = asDivision ? `${a * b} ÷ ${b} = ?` : `${a} × ${b} = ?`;
    const answer = asDivision ? a : a * b;

    return integerAnswer(ctx, stem, answer, ['muldiv', asDivision ? '/' : '*', a, b]);
  },
};

// ---------------------------------------------------------------------------
// Fracciones
// ---------------------------------------------------------------------------

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export const fractions: ExerciseGenerator = {
  id: 'matematicas.fracciones',
  label: 'Fracciones',
  pillar: 'matematicas',
  bands: ['9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng, difficulty } = ctx;
    const denominator = rng.pick(difficulty <= 2 ? [2, 4, 5, 10] : [3, 6, 8, 12, 16]);
    const numerator = rng.int(1, denominator - 1);
    const whole = rng.int(2, byDifficulty(difficulty, [10, 20, 40, 60, 100])) * denominator;
    const answer = (whole / denominator) * numerator;

    const stem = `¿Cuánto es ${numerator}/${denominator} de ${whole}?`;
    const divisor = gcd(numerator, denominator);
    const hint =
      divisor > 1
        ? `Primero simplifica: ${numerator}/${denominator} = ${numerator / divisor}/${denominator / divisor}.`
        : `Divide ${whole} entre ${denominator} y multiplica por ${numerator}.`;

    return integerAnswer(ctx, stem, answer, ['fraccion', numerator, denominator, whole], hint);
  },
};

// ---------------------------------------------------------------------------
// Porcentajes
// ---------------------------------------------------------------------------

export const percentages: ExerciseGenerator = {
  id: 'matematicas.porcentaje',
  label: 'Porcentajes',
  pillar: 'matematicas',
  bands: ['9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng, difficulty } = ctx;
    const percent = rng.pick(
      difficulty <= 2 ? [10, 25, 50, 75] : difficulty <= 4 ? [5, 15, 20, 30, 40, 60] : [12, 18, 35, 45, 65, 85],
    );

    // Para que el resultado sea siempre entero, la base debe ser múltiplo de
    // 100/mcd(porcentaje, 100). Con 20 % basta un múltiplo de 5, pero con 12 %
    // hace falta uno de 25 y con 18 %, uno de 50. Fijar un múltiplo constante
    // (p. ej. 20) produce resultados fraccionarios en cuanto el porcentaje no
    // es múltiplo de 5.
    const step = 100 / gcd(percent, 100);
    const base = rng.int(1, Math.max(2, Math.floor(500 / step))) * step;
    const answer = (base * percent) / 100;

    return integerAnswer(
      ctx,
      `¿Cuánto es el ${percent}% de ${base}?`,
      answer,
      ['porcentaje', percent, base],
      `El 1% de ${base} es ${base / 100}.`,
    );
  },
};

// ---------------------------------------------------------------------------
// Problemas verbales
// ---------------------------------------------------------------------------

export const wordProblems: ExerciseGenerator = {
  id: 'matematicas.problema',
  label: 'Problemas razonados',
  pillar: 'matematicas',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng, band, difficulty } = ctx;
    const name = rng.pick(NAMES);
    const item = rng.pick(ITEMS);

    if (band === '6-8' || difficulty <= 2) {
      const start = rng.int(6, byDifficulty(difficulty, [15, 25, 40, 60, 90]));
      const given = rng.int(1, start - 1);
      const answer = start - given;
      return integerAnswer(
        ctx,
        `${name} tenía ${start} ${item} y regaló ${given}. ¿Cuántas le quedan?`,
        answer,
        ['problema.resta', start, given],
      );
    }

    if (difficulty <= 4) {
      const price = rng.int(3, 25);
      const count = rng.int(2, 9);
      const paid = Math.ceil((price * count) / 50) * 50;
      const answer = paid - price * count;
      return integerAnswer(
        ctx,
        `${name} compró ${count} ${item} de $${price} cada una y pagó con $${paid}. ¿Cuánto le regresaron de cambio?`,
        answer,
        ['problema.cambio', price, count, paid],
        `Primero calcula ${count} × ${price}.`,
      );
    }

    // Velocidad — tiempo — distancia, con datos que dan resultado exacto.
    const speed = rng.pick([40, 50, 60, 80, 90, 120]);
    const hours = rng.pick([2, 3, 4, 5]);
    const distance = speed * hours;
    return integerAnswer(
      ctx,
      `Un autobús viaja a ${speed} km/h de forma constante. ¿Cuántas horas tarda en recorrer ${distance} km?`,
      hours,
      ['problema.velocidad', speed, distance],
      'Tiempo = distancia ÷ velocidad.',
    );
  },
};

// ---------------------------------------------------------------------------
// Ecuaciones lineales
// ---------------------------------------------------------------------------

export const linearEquations: ExerciseGenerator = {
  id: 'matematicas.ecuacion',
  label: 'Ecuaciones de primer grado',
  pillar: 'matematicas',
  bands: ['13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng, difficulty } = ctx;
    const x = rng.int(2, byDifficulty(difficulty, [8, 12, 15, 20, 30]));
    const a = rng.int(2, difficulty >= 3 ? 9 : 5);
    const b = rng.int(1, 20) * (rng.bool() ? 1 : -1);

    if (difficulty >= 4) {
      // ax + b = cx + d, con c distinto de a para que tenga solución única.
      let c = rng.int(1, a - 1 || 1);
      if (c === a) c = Math.max(1, a - 1);
      const d = (a - c) * x + b;
      const stem = `Resuelve para x:  ${a}x ${fmtSigned(b)} = ${c}x ${fmtSigned(d)}`;
      return integerAnswer(ctx, stem, x, ['ecuacion.doble', a, b, c, d], 'Agrupa las x de un lado y los números del otro.');
    }

    const result = a * x + b;
    const stem = `Resuelve para x:  ${a}x ${fmtSigned(b)} = ${result}`;
    return integerAnswer(ctx, stem, x, ['ecuacion.simple', a, b, result], `Empieza por despejar: ${a}x = ${result} ${fmtSigned(-b)}.`);
  },
};

const fmtSigned = (value: number): string => (value < 0 ? `− ${Math.abs(value)}` : `+ ${value}`);

// ---------------------------------------------------------------------------
// Proporciones
// ---------------------------------------------------------------------------

export const proportions: ExerciseGenerator = {
  id: 'matematicas.proporcion',
  label: 'Proporciones',
  pillar: 'matematicas',
  bands: ['13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng, difficulty } = ctx;
    const a = rng.int(2, 9);
    const b = rng.int(2, 12);
    const factor = rng.int(2, byDifficulty(difficulty, [3, 4, 6, 8, 12]));
    const c = a * factor;
    const answer = b * factor;

    return integerAnswer(
      ctx,
      `Si ${a} : ${b} = ${c} : x, ¿cuál es el valor de x?`,
      answer,
      ['proporcion', a, b, factor],
      `${c} es ${factor} veces ${a}.`,
    );
  },
};

// ---------------------------------------------------------------------------
// Lectura de datos (interpretación de una tabla breve)
// ---------------------------------------------------------------------------

export const dataReading: ExerciseGenerator = {
  id: 'matematicas.datos',
  label: 'Lectura de datos',
  pillar: 'matematicas',
  bands: ['9-12', '13-16'],
  difficulty: [2, 5],
  generate(ctx) {
    const { rng } = ctx;
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const;
    const values = days.map(() => rng.int(2, 30));
    const table = days.map((d, i) => `${d}: ${values[i]}`).join('\n');

    const mode = rng.pick(['total', 'promedio', 'diferencia'] as const);
    const total = values.reduce((a, b) => a + b, 0);

    if (mode === 'total') {
      return integerAnswer(ctx, `Minutos leídos por día:\n${table}\n\n¿Cuántos minutos leyó en total?`, total, ['datos.total', ...values]);
    }
    if (mode === 'diferencia') {
      const answer = Math.max(...values) - Math.min(...values);
      return integerAnswer(
        ctx,
        `Minutos leídos por día:\n${table}\n\n¿Cuál es la diferencia entre el día que más leyó y el que menos leyó?`,
        answer,
        ['datos.diferencia', ...values],
      );
    }

    // El promedio no siempre es entero: se responde con opción múltiple y un decimal.
    const average = total / values.length;
    const format = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1));
    const pool = numericDistractors(rng, average, { integer: false, spread: 4 }).map(format);
    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `Minutos leídos por día:\n${table}\n\n¿Cuál fue el promedio diario?`,
        ...buildChoices(rng, format(average), pool),
        hint: 'Suma los cinco días y divide entre 5.',
      },
      fingerprintParts: ['datos.promedio', ...values],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

export const MATH_GENERATORS: readonly ExerciseGenerator[] = [
  arithmeticBasic,
  quantityComparison,
  numberSeries,
  multiplicationDivision,
  fractions,
  percentages,
  wordProblems,
  linearEquations,
  proportions,
  dataReading,
];
