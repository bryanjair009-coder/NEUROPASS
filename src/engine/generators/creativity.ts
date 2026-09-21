import { AGE_BANDS, ageBandIndex } from '@/domain/age';
import type { Escena } from '@/domain/ilustracion';
import { buildChoices } from '@/engine/choices';
import { COLOR_FIGURA, figurasDeOpciones, type FiguraNombrada } from '@/engine/figuras';
import { OPEN_CHALLENGES, PROBLEMAS_CREATIVOS, RETOS_REUTILIZAR, STORY_SEEDS, forBand } from '@/engine/lexicon';
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
 *  2. Retos convergentes de solución de problemas: no se pregunta cuál idea
 *     es "más creativa" —eso sería arbitrario— sino cuál resuelve de verdad
 *     el problema planteado. Eso sí es verificable.
 *
 * En ambos casos la creatividad tiene un propósito. Un reto que pide ideas sin
 * ningún fin entrena la fluidez, pero no deja nada aplicable; uno que pide
 * resolver algo con lo que se tiene a mano entrena la misma flexibilidad y
 * además enseña a planear.
 *
 * El planificador limita los retos abiertos a uno por sesión (ver session.ts).
 */

const openResponseThresholds = (ctx: GenerationContext): { minChars: number; minDistinctWords: number } => {
  const band = ageBandIndex(ctx.band);
  return {
    minChars: [25, 60, 110][band] as number,
    minDistinctWords: [5, 10, 16][band] as number,
  };
};

// ---------------------------------------------------------------------------
// Reutilizar con un propósito (divergente abierto)
// ---------------------------------------------------------------------------

export const reuseWithPurpose: ExerciseGenerator = {
  id: 'creatividad.reutilizar',
  label: 'Reutilizar con un propósito',
  pillar: 'creatividad',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const reto = ctx.rng.pick(forBand(RETOS_REUTILIZAR, ctx.band, AGE_BANDS));
    const thresholds = openResponseThresholds(ctx);

    // En los niveles altos se pide además qué haría falta y qué podría fallar:
    // anticipar problemas es la parte del diseño que más cuesta.
    const extra = ctx.difficulty >= 4 ? ' Di también qué podría salir mal y cómo lo evitarías.' : '';

    return {
      prompt: {
        kind: 'open_response',
        stem: `Tienes ${reto.material}. Úsalo para ${reto.necesidad}.\n\nExplica cómo lo harías, paso a paso.${extra}`,
        placeholder: 'Primero...\nDespués...\nAl final...',
        ...thresholds,
        hint: 'Piensa qué forma tiene el material y qué necesitas que haga. Después ordena los pasos.',
      },
      fingerprintParts: ['creatividad.reutilizar', reto.material, reto.necesidad, extra ? 'riesgos' : 'pasos'],
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
// Soluciones creativas (convergente y verificable)
// ---------------------------------------------------------------------------

export const creativeSolutions: ExerciseGenerator = {
  id: 'creatividad.soluciones',
  label: 'Soluciones creativas',
  pillar: 'creatividad',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng } = ctx;
    const problema = rng.pick(forBand(PROBLEMAS_CREATIVOS, ctx.band, AGE_BANDS));

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `${problema.situacion}\n\n¿Cuál idea sí resuelve el problema?`,
        ...buildChoices(rng, problema.correcta, problema.incorrectas),
        hint: 'Imagina que haces cada idea de verdad. ¿Cuál termina resolviendo el problema?',
      },
      fingerprintParts: ['creatividad.soluciones', problema.situacion],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty) + 10,
    };
  },
};

// ---------------------------------------------------------------------------
// Patrones de color
// ---------------------------------------------------------------------------

/** Círculos de colores: el patrón está en el color, así que la forma no cambia. */
const PATTERN_COLORS: readonly FiguraNombrada[] = [
  { nombre: 'rojo', figura: { forma: 'circulo', color: COLOR_FIGURA.rojo } },
  { nombre: 'azul', figura: { forma: 'circulo', color: COLOR_FIGURA.azul } },
  { nombre: 'verde', figura: { forma: 'circulo', color: COLOR_FIGURA.verde } },
  { nombre: 'amarillo', figura: { forma: 'circulo', color: COLOR_FIGURA.amarillo } },
  { nombre: 'morado', figura: { forma: 'circulo', color: COLOR_FIGURA.morado } },
  { nombre: 'naranja', figura: { forma: 'circulo', color: COLOR_FIGURA.naranja } },
];

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
    const rendered = Array.from({ length }, (_, i) => cycle[i % period] as FiguraNombrada);
    const answer = cycle[length % period] as FiguraNombrada;
    const distractors = PATTERN_COLORS.filter((c) => c !== answer).map((c) => c.nombre);
    const choices = buildChoices(rng, answer.nombre, rng.shuffle(distractors));

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: '¿Qué color sigue el patrón?',
        ilustracion: { tipo: 'figuras', filas: [[...rendered.map((c) => c.figura), null]] },
        ...choices,
        figurasOpciones: figurasDeOpciones(choices.options, PATTERN_COLORS),
      },
      fingerprintParts: ['creatividad.patron', ...cycle.map((c) => c.nombre)],
      timeLimitSec: timeLimitFor(ctx.band, difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Título para una escena
// ---------------------------------------------------------------------------

/**
 * Escenas ilustradas. Cada descripción dice solo lo que el dibujo muestra: si
 * el texto contara más que la imagen, el menor inventaría el título a partir
 * del texto y la ilustración sobraría.
 */
const SCENES: readonly { readonly escena: Escena; readonly descripcion: string }[] = [
  {
    escena: { cielo: 'noche', suelo: 'nieve', astros: ['luna', 'estrellas'], elementos: ['montana', 'casa'] },
    descripcion: 'una casita al pie de una montaña nevada, en una noche estrellada',
  },
  {
    escena: { cielo: 'dia', clima: 'lluvia', suelo: 'pasto', astros: ['nube'], elementos: ['casa', 'arbol'] },
    descripcion: 'una casa y un árbol en un día de lluvia',
  },
  {
    escena: { cielo: 'atardecer', suelo: 'mar', astros: ['sol'], elementos: ['barco'] },
    descripcion: 'un barco de vela navegando al atardecer',
  },
  {
    escena: { cielo: 'noche', suelo: 'pasto', astros: ['luna', 'estrellas'], elementos: ['cohete'] },
    descripcion: 'un cohete listo para despegar en medio de la noche',
  },
  {
    escena: { cielo: 'dia', suelo: 'arena', astros: ['sol'], elementos: ['cactus', 'cactus'] },
    descripcion: 'dos cactus solos en el desierto, bajo un sol fuerte',
  },
  {
    escena: { cielo: 'dia', suelo: 'pasto', astros: ['nube', 'sol'], elementos: ['arbol', 'globo'] },
    descripcion: 'un globo rosa junto a un árbol en el parque',
  },
  {
    escena: { cielo: 'atardecer', suelo: 'pasto', astros: ['sol'], elementos: ['flor', 'arbol', 'flor'] },
    descripcion: 'un jardín con flores y un árbol al atardecer',
  },
  {
    escena: { cielo: 'dia', suelo: 'playa', astros: ['sol', 'nube'], elementos: ['faro'] },
    descripcion: 'un faro solitario en la orilla del mar',
  },
  {
    escena: { cielo: 'noche', suelo: 'pasto', astros: ['estrellas', 'luna'], elementos: ['tienda', 'arbol'] },
    descripcion: 'una tienda de campaña bajo las estrellas',
  },
  {
    escena: { cielo: 'dia', clima: 'nieve', suelo: 'nieve', astros: ['nube'], elementos: ['arbol', 'casa', 'arbol'] },
    descripcion: 'una casa entre árboles mientras cae la nieve',
  },
];

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
        stem: `Esta escena muestra ${scene.descripcion}. Inventa un título para ella y explica en una frase por qué lo elegiste.`,
        ilustracion: { tipo: 'escena', escena: scene.escena },
        placeholder: 'Título: ...\nPorque: ...',
        minChars: Math.round(thresholds.minChars * 0.7),
        minDistinctWords: Math.max(5, thresholds.minDistinctWords - 4),
      },
      fingerprintParts: ['creatividad.titulo', scene.descripcion],
      timeLimitSec: null,
    };
  },
};

export const CREATIVITY_GENERATORS: readonly ExerciseGenerator[] = [
  reuseWithPurpose,
  continueStory,
  openChallenge,
  creativeSolutions,
  colorPattern,
  sceneTitle,
];
