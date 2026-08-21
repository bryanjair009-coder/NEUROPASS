import { AGE_BANDS, ageBandIndex } from '@/domain/age';
import { buildChoices } from '@/engine/choices';
import { EVERYDAY_OBJECTS, OPEN_CHALLENGES, STORY_SEEDS, forBand } from '@/engine/lexicon';
import { byDifficulty, timeLimitFor } from '@/engine/scale';
import type { ExerciseGenerator, GenerationContext } from '@/engine/types';

/**
 * Pilar 2 — Creatividad.
 *
 * Aquí está la tensión de diseño más honesta de la app: la creatividad
 * divergente no tiene respuesta correcta y por lo tanto no es autocalificable
 * en un dispositivo sin conexión. Se resuelve por dos vías, y ninguna finge
 * medir originalidad:
 *
 *  1. `open_response`: se califica el *esfuerzo* con un umbral explícito
 *     (extensión y riqueza léxica mínimas) y la respuesta queda disponible en
 *     el panel del tutor. Nunca se marca como incorrecta: la calificación es
 *     `accepted` o `skipped`. Sale del dispositivo solo si el tutor la exporta.
 *  2. Retos convergentes de asociación: no se pregunta cuál idea es "más
 *     creativa" —eso sería arbitrario— sino cuál combina efectivamente los dos
 *     conceptos dados. Eso sí es verificable, y sigue ejercitando la
 *     asociación remota.
 *
 * El planificador limita los retos abiertos a uno por sesión (ver session.ts).
 */

/** Función característica de cada objeto, para construir combinaciones verificables. */
const OBJECT_FUNCTIONS: Readonly<Record<string, string>> = {
  'una caja de cartón': 'guardar cosas',
  'un clip': 'sujetar papeles',
  'una cuchara': 'servir comida',
  'una botella vacía': 'contener líquido',
  'un calcetín sin par': 'abrigar el pie',
  'una liga': 'estirarse y volver',
  'un periódico viejo': 'informar con texto',
  'una llanta usada': 'rodar sobre el piso',
  'un vaso de plástico': 'beber algo',
  'una cuerda': 'amarrar dos cosas',
};

const openResponseThresholds = (ctx: GenerationContext): { minChars: number; minDistinctWords: number } => {
  const band = ageBandIndex(ctx.band);
  return {
    minChars: [25, 60, 110][band] as number,
    minDistinctWords: [5, 10, 16][band] as number,
  };
};

// ---------------------------------------------------------------------------
// Usos alternativos (divergente abierto)
// ---------------------------------------------------------------------------

/**
 * Restricciones que acompañan al objeto. Una restricción explícita mejora la
 * producción divergente —obliga a abandonar la primera idea obvia— y de paso
 * multiplica el espacio de retos, que con solo diez objetos sería demasiado
 * pequeño para no repetirse en pocos días.
 */
const USE_CONSTRAINTS = [
  'que sirvan dentro de la escuela',
  'que ayuden a otra persona',
  'que no necesiten las manos',
  'que funcionen de noche',
  'que sirvan afuera, en la calle',
  'que un animal también pueda usar',
  'que no cuesten nada de dinero',
] as const;

export const alternativeUses: ExerciseGenerator = {
  id: 'creatividad.usos',
  label: 'Usos alternativos',
  pillar: 'creatividad',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const object = ctx.rng.pick(EVERYDAY_OBJECTS);
    const count = byDifficulty(ctx.difficulty, [2, 2, 3, 3, 4]);
    const thresholds = openResponseThresholds(ctx);

    // A partir de dificultad 2 se añade una restricción; en el nivel 1 el reto
    // se deja libre para no abrumar a quien apenas empieza.
    const constraint = ctx.difficulty >= 2 ? ctx.rng.pick(USE_CONSTRAINTS) : null;
    const stem = constraint
      ? `Escribe ${count} usos distintos que le darías a ${object}, ${constraint}. Ninguno puede ser el uso normal.`
      : `Escribe ${count} usos distintos que le darías a ${object}, sin que ninguno sea el uso normal.`;

    return {
      prompt: {
        kind: 'open_response',
        stem,
        placeholder: 'Escribe tus ideas, una por línea...',
        ...thresholds,
        hint: 'No hay respuesta incorrecta. Piensa en usos que a nadie más se le ocurrirían.',
      },
      fingerprintParts: ['creatividad.usos', object, count, constraint ?? 'libre'],
      timeLimitSec: null,
    };
  },
};

// ---------------------------------------------------------------------------
// Continuar la historia
// ---------------------------------------------------------------------------

export const continueStory: ExerciseGenerator = {
  id: 'creatividad.historia',
  label: 'Continúa la historia',
  pillar: 'creatividad',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const seed = ctx.rng.pick(forBand(STORY_SEEDS, ctx.band, AGE_BANDS));
    const thresholds = openResponseThresholds(ctx);

    return {
      prompt: {
        kind: 'open_response',
        stem: `${seed.text}\n\n¿Qué pasa después? Continúa la historia.`,
        placeholder: 'Y entonces...',
        ...thresholds,
      },
      fingerprintParts: ['creatividad.historia', seed.text],
      timeLimitSec: null,
    };
  },
};

// ---------------------------------------------------------------------------
// Retos abiertos de diseño
// ---------------------------------------------------------------------------

export const openChallenge: ExerciseGenerator = {
  id: 'creatividad.reto',
  label: 'Reto abierto',
  pillar: 'creatividad',
  bands: ['13-16'],
  difficulty: [3, 5],
  generate(ctx) {
    const challenge = ctx.rng.pick(OPEN_CHALLENGES);
    const thresholds = openResponseThresholds(ctx);

    return {
      prompt: {
        kind: 'open_response',
        stem: challenge,
        placeholder: 'Describe tu propuesta y por qué funcionaría...',
        minChars: thresholds.minChars + 40,
        minDistinctWords: thresholds.minDistinctWords + 6,
      },
      fingerprintParts: ['creatividad.reto', challenge],
      timeLimitSec: null,
    };
  },
};

// ---------------------------------------------------------------------------
// Asociación remota (convergente y verificable)
// ---------------------------------------------------------------------------

export const remoteAssociation: ExerciseGenerator = {
  id: 'creatividad.asociacion',
  label: 'Asociación de ideas',
  pillar: 'creatividad',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng } = ctx;
    const [objectA, objectB] = rng.sample(EVERYDAY_OBJECTS, 2);
    if (!objectA || !objectB) throw new Error('Corpus de objetos insuficiente');

    const functionB = OBJECT_FUNCTIONS[objectB] ?? 'usarse de otra forma';
    const functionA = OBJECT_FUNCTIONS[objectA] ?? 'usarse de otra forma';

    // La respuesta correcta es la única que integra ambos objetos; las demás
    // se quedan en uno solo. Es un criterio objetivo, no una opinión sobre
    // cuál idea es "más creativa".
    const answer = `${capitalize(objectA)} que también sirve para ${functionB}`;
    const distractors = [
      `${capitalize(objectA)} pero más grande`,
      `${capitalize(objectB)} de color azul`,
      `${capitalize(objectA)} que sirve para ${functionA}`,
      `${capitalize(objectB)} guardado en una caja`,
    ];

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `Tienes que inventar algo que combine ${objectA} y ${objectB}.\n\n¿Cuál de estas ideas usa de verdad las dos cosas?`,
        ...buildChoices(rng, answer, distractors),
        hint: 'Una idea que solo cambia el tamaño o el color no está combinando nada.',
      },
      fingerprintParts: ['creatividad.asociacion', objectA, objectB],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Patrones de color
// ---------------------------------------------------------------------------

const PATTERN_COLORS = ['🟥', '🟦', '🟩', '🟨', '🟪', '🟧'] as const;

export const colorPattern: ExerciseGenerator = {
  id: 'creatividad.patron',
  label: 'Patrones de color',
  pillar: 'creatividad',
  bands: ['6-8'],
  difficulty: [1, 3],
  generate(ctx) {
    const { rng, difficulty } = ctx;
    const period = byDifficulty(difficulty, [2, 3, 3, 3, 3]);
    const cycle = rng.sample(PATTERN_COLORS, period);

    const length = period * 3;
    const rendered = Array.from({ length }, (_, i) => cycle[i % period] as string);
    const answer = cycle[length % period] as string;
    const distractors = PATTERN_COLORS.filter((c) => c !== answer);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `¿Qué color sigue el patrón?\n\n${rendered.join(' ')} ❓`,
        ...buildChoices(rng, answer, rng.shuffle(distractors)),
      },
      fingerprintParts: ['creatividad.patron', ...cycle],
      timeLimitSec: timeLimitFor(ctx.band, difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Título para una escena
// ---------------------------------------------------------------------------

const SCENES = [
  { emoji: '🌧️🐕🏠', description: 'un perro mirando la lluvia desde la puerta' },
  { emoji: '🚀🌕👨‍🚀', description: 'un astronauta llegando a la Luna' },
  { emoji: '📚🕯️🦉', description: 'un búho leyendo a la luz de una vela' },
  { emoji: '🏖️⛱️🦀', description: 'un cangrejo tomando el sol en la playa' },
  { emoji: '🎪🐘🎈', description: 'un elefante escapando del circo con globos' },
  { emoji: '🚲🌆🌅', description: 'alguien cruzando la ciudad en bici al amanecer' },
  { emoji: '🐋🎻🌊', description: 'una ballena escuchando un violín bajo el agua' },
  { emoji: '🕰️🏚️🌿', description: 'un reloj todavía andando en una casa abandonada' },
  { emoji: '🦊❄️🏔️', description: 'un zorro cruzando solo una montaña nevada' },
  { emoji: '📮✉️🌵', description: 'un buzón lleno de cartas en medio del desierto' },
] as const;

export const sceneTitle: ExerciseGenerator = {
  id: 'creatividad.titulo',
  label: 'Inventa un título',
  pillar: 'creatividad',
  bands: ['9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const scene = ctx.rng.pick(SCENES);
    const thresholds = openResponseThresholds(ctx);

    return {
      prompt: {
        kind: 'open_response',
        stem: `${scene.emoji}\n\nEsta escena muestra ${scene.description}. Inventa un título para ella y explica en una frase por qué lo elegiste.`,
        placeholder: 'Título: ...\nPorque: ...',
        minChars: Math.round(thresholds.minChars * 0.7),
        minDistinctWords: Math.max(5, thresholds.minDistinctWords - 4),
      },
      fingerprintParts: ['creatividad.titulo', scene.description],
      timeLimitSec: null,
    };
  },
};

const capitalize = (value: string): string => value.charAt(0).toLocaleUpperCase('es') + value.slice(1);

export const CREATIVITY_GENERATORS: readonly ExerciseGenerator[] = [
  alternativeUses,
  continueStory,
  openChallenge,
  remoteAssociation,
  colorPattern,
  sceneTitle,
];
