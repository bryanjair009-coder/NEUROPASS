import { AGE_BANDS } from '@/domain/age';
import type { Figura } from '@/domain/ilustracion';
import { buildChoices } from '@/engine/choices';
import { FIGURAS_LOGICA, figurasDeOpciones } from '@/engine/figuras';
import { ANALOGIES, CATEGORIES, forBand } from '@/engine/lexicon';
import { byDifficulty, timeLimitFor } from '@/engine/scale';
import type { ExerciseGenerator, GenerationContext } from '@/engine/types';

/**
 * Pilar 4 — Lógica.
 *
 * Las figuras de las series y las matrices se describen como datos y la
 * interfaz las dibuja. Siguen sin depender de imágenes que haya que versionar,
 * y cada opción conserva su nombre —«rombo hueco»—, que es lo que anuncia un
 * lector de pantalla.
 */

/** Todas las figuras de lógica, llenas y huecas: el relleno es un eje del razonamiento. */
const CATALOGO_LOGICA = FIGURAS_LOGICA.flatMap((f) => [f.llena, f.hueca]);

const PEOPLE = ['Ana', 'Beto', 'Caro', 'Dani', 'Elsa', 'Fito', 'Gina', 'Hugo'] as const;

// ---------------------------------------------------------------------------
// El intruso
// ---------------------------------------------------------------------------

export const oddOneOut: ExerciseGenerator = {
  id: 'logica.intruso',
  label: 'Encuentra el intruso',
  pillar: 'logica',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const pool = forBand(CATEGORIES, ctx.band, AGE_BANDS);
    const [home, foreign] = ctx.rng.sample(pool, 2);
    if (!home || !foreign) throw new Error('Corpus de categorías insuficiente');

    const optionCount = byDifficulty(ctx.difficulty, [4, 4, 5, 5, 6]);
    const members = ctx.rng.sample(home.members, optionCount - 1);
    const intruder = ctx.rng.pick(foreign.members);
    const options = ctx.rng.shuffle([...members, intruder]);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: '¿Cuál de estas palabras no pertenece al grupo?',
        options,
        correctIndex: options.indexOf(intruder),
        hint: `Cuatro de ellas comparten una misma categoría.`,
      },
      fingerprintParts: ['intruso', home.name, intruder, ...members.slice().sort()],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Clasificación
// ---------------------------------------------------------------------------

export const classification: ExerciseGenerator = {
  id: 'logica.clasificacion',
  label: 'Clasificar por categoría',
  pillar: 'logica',
  bands: ['6-8', '9-12'],
  difficulty: [1, 3],
  generate(ctx) {
    const pool = forBand(CATEGORIES, ctx.band, AGE_BANDS);
    const chosen = ctx.rng.sample(pool, 4);
    const target = chosen[0];
    if (!target || chosen.length < 4) throw new Error('Corpus de categorías insuficiente');

    const member = ctx.rng.pick(target.members);
    const options = ctx.rng.shuffle(chosen.map((c) => c.name));

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `¿A qué grupo pertenece "${member}"?`,
        options,
        correctIndex: options.indexOf(target.name),
      },
      fingerprintParts: ['clasificacion', member, target.name],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Series de figuras
// ---------------------------------------------------------------------------

export const figureSeries: ExerciseGenerator = {
  id: 'logica.serie_figuras',
  label: 'Series de figuras',
  pillar: 'logica',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng, difficulty } = ctx;
    const period = byDifficulty(difficulty, [2, 3, 3, 4, 4]);
    const alternateFill = difficulty >= 3;

    const base = rng.sample(FIGURAS_LOGICA, period);
    const cycle = base.map((f) => f.llena.nombre);
    const repeats = 3;

    const rendered: Figura[] = [];
    for (let i = 0; i < period * repeats; i += 1) {
      const figure = base[i % period];
      if (!figure) throw new Error('Ciclo de figuras vacío');
      // Con relleno alternante, cada vuelta invierte el estado sólido/hueco.
      const solid = !alternateFill || Math.floor(i / period) % 2 === 0;
      rendered.push(solid ? figure.llena.figura : figure.hueca.figura);
    }

    const nextIndex = period * repeats;
    const nextFigure = base[nextIndex % period];
    if (!nextFigure) throw new Error('Ciclo de figuras vacío');
    const nextSolid = !alternateFill || Math.floor(nextIndex / period) % 2 === 0;
    const answer = nextSolid ? nextFigure.llena.nombre : nextFigure.hueca.nombre;

    const distractors = CATALOGO_LOGICA.map((f) => f.nombre).filter((s) => s !== answer);
    const choices = buildChoices(rng, answer, rng.shuffle(distractors));

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: '¿Qué figura continúa la serie?',
        ilustracion: { tipo: 'figuras', filas: [[...rendered, null]] },
        ...choices,
        figurasOpciones: figurasDeOpciones(choices.options, CATALOGO_LOGICA),
        ...(alternateFill ? { hint: 'Fíjate en el orden de las figuras y también en si están llenas o huecas.' } : {}),
      },
      fingerprintParts: ['serie_figuras', period, alternateFill ? 'alt' : 'plano', ...cycle],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Matriz de razonamiento abstracto (estilo Raven, 2x2)
// ---------------------------------------------------------------------------

export const abstractMatrix: ExerciseGenerator = {
  id: 'logica.matriz',
  label: 'Matriz de razonamiento',
  pillar: 'logica',
  bands: ['9-12', '13-16'],
  difficulty: [2, 5],
  generate(ctx) {
    const { rng } = ctx;
    const [figA, figB] = rng.sample(FIGURAS_LOGICA, 2);
    if (!figA || !figB) throw new Error('Corpus de figuras insuficiente');

    // Regla: avanzar en la fila vacía la figura; avanzar en la columna la cambia.
    const answer = figB.hueca.nombre;

    // Distractores que corresponden a aplicar mal *una* de las dos reglas.
    const distractors = [
      figB.llena.nombre,
      figA.hueca.nombre,
      figA.llena.nombre,
      ...FIGURAS_LOGICA.map((f) => f.hueca.nombre),
    ].filter((s) => s !== answer);
    const choices = buildChoices(rng, answer, distractors);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: 'Completa la matriz:',
        ilustracion: {
          tipo: 'figuras',
          filas: [
            [figA.llena.figura, figA.hueca.figura],
            [figB.llena.figura, null],
          ],
        },
        ...choices,
        figurasOpciones: figurasDeOpciones(choices.options, CATALOGO_LOGICA),
        hint: 'Compara qué cambia de izquierda a derecha en la primera fila y aplícalo a la segunda.',
      },
      fingerprintParts: ['matriz', figA.llena.nombre, figB.llena.nombre],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Analogías
// ---------------------------------------------------------------------------

export const analogies: ExerciseGenerator = {
  id: 'logica.analogia',
  label: 'Analogías',
  pillar: 'logica',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const pool = forBand(ANALOGIES, ctx.band, AGE_BANDS);
    const item = ctx.rng.pick(pool);

    // Los distractores salen de los términos *b* y *d* de otras analogías: son
    // palabras del mismo tipo gramatical, así que no se descartan por forma.
    const distractors = ctx.rng
      .shuffle(pool.filter((other) => other !== item).flatMap((other) => [other.b, other.d]))
      .filter((word) => word !== item.d && word !== item.c && word !== item.a && word !== item.b);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `${item.a} es a ${item.b} como ${item.c} es a ...`,
        ...buildChoices(ctx.rng, item.d, distractors),
        hint: `La relación es: ${item.relation}.`,
      },
      fingerprintParts: ['analogia', item.a, item.c],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Deducción
// ---------------------------------------------------------------------------

export const deduction: ExerciseGenerator = {
  id: 'logica.deduccion',
  label: 'Deducción lógica',
  pillar: 'logica',
  bands: ['9-12', '13-16'],
  difficulty: [2, 5],
  generate(ctx) {
    return ctx.difficulty >= 4 && ctx.band === '13-16' ? modusTollens(ctx) : transitiveOrdering(ctx);
  },
};

/** Cadena transitiva: A > B > C > ... ¿quién está en un extremo? */
function transitiveOrdering(ctx: GenerationContext) {
  const { rng, difficulty } = ctx;
  const chainLength = byDifficulty(difficulty, [3, 3, 4, 4, 5]);
  const people = rng.sample(PEOPLE, chainLength);
  const trait = rng.pick([
    { comparative: 'más alta que', low: 'la más baja', high: 'la más alta' },
    { comparative: 'más rápida que', low: 'la más lenta', high: 'la más rápida' },
    { comparative: 'mayor que', low: 'la menor', high: 'la mayor' },
  ] as const);

  // Se enuncian los pares en orden aleatorio para que no baste con leer en línea.
  const statements = rng.shuffle(
    people.slice(0, -1).map((person, i) => `${person} es ${trait.comparative} ${people[i + 1]}.`),
  );

  const askLowest = rng.bool();
  const answer = (askLowest ? people[people.length - 1] : people[0]) as string;
  const distractors = people.filter((p) => p !== answer);

  return {
    prompt: {
      kind: 'multiple_choice' as const,
      stem: `${statements.join(' ')}\n\n¿Quién es ${askLowest ? trait.low : trait.high}?`,
      ...buildChoices(rng, answer, distractors, Math.min(4, people.length)),
      hint: 'Ordena a todos en una sola fila antes de responder.',
    },
    fingerprintParts: ['deduccion.orden', askLowest ? 'min' : 'max', ...people],
    timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
  };
}

/** Modus tollens: si P entonces Q; no Q; luego no P. El error clásico es afirmar el consecuente. */
function modusTollens(ctx: GenerationContext) {
  const { rng } = ctx;
  const person = rng.pick(PEOPLE);
  const scenario = rng.pick([
    { p: 'llueve', q: `${person} lleva paraguas`, notP: 'No está lloviendo', notQ: `${person} no lleva paraguas` },
    { p: 'hay clase', q: `${person} usa uniforme`, notP: 'No hay clase', notQ: `${person} no usa uniforme` },
    { p: 'el museo está abierto', q: `${person} entra a la exposición`, notP: 'El museo está cerrado', notQ: `${person} no entró a la exposición` },
  ] as const);

  const answer = scenario.notP;
  const distractors = [
    `${capitalize(scenario.p)}`,
    `${capitalize(scenario.q)}`,
    'No se puede saber con la información dada',
  ];

  return {
    prompt: {
      kind: 'multiple_choice' as const,
      stem: `Si ${scenario.p}, entonces ${scenario.q}.\n${capitalize(scenario.notQ)}.\n\n¿Qué se concluye necesariamente?`,
      ...buildChoices(rng, answer, distractors),
      hint: 'Si la consecuencia no ocurrió, la condición tampoco pudo cumplirse.',
    },
    fingerprintParts: ['deduccion.tollens', scenario.p, person],
    timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
  };
}

const capitalize = (s: string): string => s.charAt(0).toLocaleUpperCase('es') + s.slice(1);

// ---------------------------------------------------------------------------
// Orientación espacial
// ---------------------------------------------------------------------------

const HEADINGS = ['norte', 'este', 'sur', 'oeste'] as const;

export const spatialOrientation: ExerciseGenerator = {
  id: 'logica.orientacion',
  label: 'Orientación espacial',
  pillar: 'logica',
  bands: ['9-12', '13-16'],
  difficulty: [2, 5],
  generate(ctx) {
    const { rng, difficulty } = ctx;
    const steps = byDifficulty(difficulty, [2, 3, 3, 4, 5]);
    const vectors: Record<(typeof HEADINGS)[number], readonly [number, number]> = {
      norte: [0, 1],
      este: [1, 0],
      sur: [0, -1],
      oeste: [-1, 0],
    };

    let x = 0;
    let y = 0;
    const legs: string[] = [];
    for (let i = 0; i < steps; i += 1) {
      const heading = rng.pick(HEADINGS);
      const blocks = rng.int(1, 6);
      const [dx, dy] = vectors[heading];
      x += dx * blocks;
      y += dy * blocks;
      legs.push(`${blocks} ${blocks === 1 ? 'cuadra' : 'cuadras'} al ${heading}`);
    }

    // Se descarta el caso degenerado en el que se regresa al origen.
    if (x === 0 && y === 0) {
      x = 1;
      legs.push('1 cuadra al este');
    }

    const answer = describeReturn(x, y);
    const distractors = [
      describeReturn(-x, y),
      describeReturn(x, -y),
      describeReturn(y, x),
      describeReturn(-x, -y),
      'Justo en el punto de partida',
    ].filter((d) => d !== answer);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `Sales de tu casa y caminas ${legs.join(', luego ')}.\n\n¿En qué dirección queda tu casa desde donde estás ahora?`,
        ...buildChoices(rng, answer, distractors),
        hint: 'Suma por separado los movimientos norte-sur y los este-oeste.',
      },
      fingerprintParts: ['orientacion', ...legs],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

/** Describe hacia dónde queda el origen desde la posición (x, y). */
function describeReturn(x: number, y: number): string {
  if (x === 0 && y === 0) return 'Justo en el punto de partida';
  const vertical = y > 0 ? 'sur' : y < 0 ? 'norte' : '';
  const horizontal = x > 0 ? 'oeste' : x < 0 ? 'este' : '';
  if (!vertical) return `Al ${horizontal}`;
  if (!horizontal) return `Al ${vertical}`;
  return `Al ${vertical}${horizontal}`;
}

export const LOGIC_GENERATORS: readonly ExerciseGenerator[] = [
  oddOneOut,
  classification,
  figureSeries,
  abstractMatrix,
  analogies,
  deduction,
  spatialOrientation,
];
