import type { AgeBand } from '@/domain/age';
import type { Difficulty, Exercise } from '@/domain/exercise';
import { PILLARS, type Pillar } from '@/domain/pillar';
import { CREATIVITY_GENERATORS } from '@/engine/generators/creativity';
import { LANGUAGE_GENERATORS } from '@/engine/generators/language';
import { LOGIC_GENERATORS } from '@/engine/generators/logic';
import { MATH_GENERATORS } from '@/engine/generators/math';
import { MEMORY_GENERATORS } from '@/engine/generators/memory';
import { timeLimitFor } from '@/engine/scale';
import type { ExerciseGenerator } from '@/engine/types';
import { fingerprintOf, type Rng } from '@/lib/rng';

/**
 * Índice de todos los generadores procedurales, con las consultas que el
 * planificador necesita. Se construye una sola vez y se indexa por
 * pilar + rango para no filtrar el arreglo completo en cada selección.
 */

export const ALL_GENERATORS: readonly ExerciseGenerator[] = [
  ...MATH_GENERATORS,
  ...CREATIVITY_GENERATORS,
  ...MEMORY_GENERATORS,
  ...LOGIC_GENERATORS,
  ...LANGUAGE_GENERATORS,
];

const byId = new Map(ALL_GENERATORS.map((g) => [g.id, g]));

if (byId.size !== ALL_GENERATORS.length) {
  throw new Error('Hay generadores con id duplicado en el catálogo');
}

type IndexKey = `${Pillar}|${AgeBand}`;

const index = new Map<IndexKey, ExerciseGenerator[]>();
for (const generator of ALL_GENERATORS) {
  for (const band of generator.bands) {
    const key: IndexKey = `${generator.pillar}|${band}`;
    const bucket = index.get(key);
    if (bucket) bucket.push(generator);
    else index.set(key, [generator]);
  }
}

export function generatorById(id: string): ExerciseGenerator | undefined {
  return byId.get(id);
}

/**
 * Generadores aplicables a un pilar, rango y (opcionalmente) dificultad.
 *
 * Si ningún generador cubre la dificultad exacta se devuelve el conjunto
 * completo del rango en lugar de un arreglo vacío: es preferible presentar un
 * reto de dificultad contigua que dejar al menor sin ejercicio.
 */
export function generatorsFor(
  pillar: Pillar,
  band: AgeBand,
  difficulty?: Difficulty,
): readonly ExerciseGenerator[] {
  const bucket = index.get(`${pillar}|${band}`) ?? [];
  if (difficulty === undefined) return bucket;

  const exact = bucket.filter(
    (generator) => difficulty >= generator.difficulty[0] && difficulty <= generator.difficulty[1],
  );
  return exact.length > 0 ? exact : bucket;
}

/** Acota una dificultad al rango que el generador declara soportar. */
export function clampToGenerator(generator: ExerciseGenerator, difficulty: Difficulty): Difficulty {
  const [min, max] = generator.difficulty;
  return Math.min(max, Math.max(min, difficulty)) as Difficulty;
}

/**
 * Materializa un reto: ejecuta el generador y le añade identidad, huella y
 * límite de tiempo. Es el único punto donde un `GeneratedExercise` se
 * convierte en `Exercise`, de modo que la huella se calcula siempre igual.
 */
export function materialize(
  generator: ExerciseGenerator,
  band: AgeBand,
  difficulty: Difficulty,
  rng: Rng,
  instanceIndex: number,
): Exercise {
  const generated = generator.generate({ rng, band, difficulty });
  const fingerprint = fingerprintOf(generator.id, band, ...generated.fingerprintParts);

  return {
    id: `${instanceIndex}-${fingerprint}`,
    sourceId: generator.id,
    pillar: generator.pillar,
    band,
    difficulty,
    fingerprint,
    // `undefined` significa "el generador no opinó" y se calcula el límite por
    // defecto; `null` significa "este reto no lleva cronómetro" y hay que
    // respetarlo. Un `??` aquí colapsaba ambos casos y ponía cuenta atrás a los
    // retos de escritura libre, que al llegar a cero se enviaban solos y
    // borraban lo que el menor llevaba escrito.
    timeLimitSec:
      generated.timeLimitSec !== undefined ? generated.timeLimitSec : timeLimitFor(band, difficulty),
    prompt: generated.prompt,
  };
}

/** Cobertura del catálogo, para diagnósticos y para la pantalla de tutor. */
export function catalogCoverage(): Record<Pillar, Record<AgeBand, number>> {
  const result = {} as Record<Pillar, Record<AgeBand, number>>;
  for (const pillar of PILLARS) {
    result[pillar] = { '6-8': 0, '9-12': 0, '13-16': 0 };
    for (const band of ['6-8', '9-12', '13-16'] as const) {
      result[pillar][band] = (index.get(`${pillar}|${band}`) ?? []).length;
    }
  }
  return result;
}
