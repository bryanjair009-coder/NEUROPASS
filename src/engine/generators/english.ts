import { AGE_BANDS } from '@/domain/age';
import { buildChoices } from '@/engine/choices';
import {
  ADVERBIOS_FRECUENCIA,
  COLORES,
  COMPARATIVOS,
  COMPLEMENTOS_TO_BE,
  COSAS_UBICABLES,
  FALSOS_AMIGOS,
  LECTURAS,
  LUGARES,
  MARCADORES_PASADO,
  NUMEROS,
  ORACIONES_TRADUCCION,
  PALABRAS_TRADUCCION,
  PREPOSICIONES,
  SALUDOS,
  SUJETOS_TO_BE,
  SUJETOS_VERBO,
  VERBOS,
  VOCABULARIO_VISUAL,
} from '@/engine/englishLexicon';
import { forBand } from '@/engine/lexicon';
import { timeLimitFor } from '@/engine/scale';
import type { ExerciseGenerator } from '@/engine/types';

/**
 * Inglés como lengua extranjera, dentro del pilar de Lenguaje.
 *
 * Va dentro de Lenguaje y no como sexto pilar porque lo que entrena es la
 * misma competencia —vocabulario, gramática, comprensión— en otra lengua. Un
 * pilar aparte habría partido en dos la maestría lingüística del menor y
 * añadido un sexto «poder» que el tutor puede apagar, lo que deja el panel de
 * progreso con un hueco cada vez que lo hace.
 *
 * La progresión sigue los primeros niveles del Marco Común Europeo, adaptados
 * a la edad y no solo al nivel:
 *
 *  - **6 a 8 años (pre-A1).** Reconocimiento, no producción. Palabras concretas
 *    con apoyo visual, números, colores y saludos. Nada de gramática explícita:
 *    a esta edad la segunda lengua se adquiere por exposición y significado,
 *    y una regla abstracta todavía no se puede aplicar.
 *  - **9 a 12 años (A1).** Aparece la oración: «to be», presente simple,
 *    preposiciones de lugar y traducción de palabras. Cada estructura se
 *    presenta en un contexto que fuerza una única respuesta correcta.
 *  - **13 a 16 años (A2).** Pasado simple, comparativos, falsos amigos y
 *    lecturas cortas. Ya pueden reflexionar sobre la lengua, así que los
 *    distractores son los errores típicos del hispanohablante.
 *
 * Las instrucciones van siempre en español: el objetivo es aprender el
 * contenido, y una consigna que no se entiende convierte el reto en adivinar.
 *
 * Todos los generadores llevan `idioma: 'en'` para que el planificador pueda
 * retirarlos cuando el tutor desactiva el inglés.
 */

// ---------------------------------------------------------------------------
// 6-8 · Vocabulario con imagen
// ---------------------------------------------------------------------------

export const vocabularioImagen: ExerciseGenerator = {
  id: 'ingles.vocabulario_imagen',
  label: 'Inglés: vocabulario con imagen',
  pillar: 'lenguaje',
  idioma: 'en',
  bands: ['6-8', '9-12'],
  difficulty: [1, 3],
  generate(ctx) {
    const { rng, difficulty } = ctx;
    const item = rng.pick(VOCABULARIO_VISUAL);

    // En el nivel más fácil los distractores son de otra categoría («dog»
    // frente a «banana»), y se resuelve por descarte. Desde el siguiente son
    // de la misma («dog» frente a «cat»), y hay que conocer la palabra.
    const misma = rng
      .shuffle(VOCABULARIO_VISUAL.filter((o) => o.categoria === item.categoria && o.en !== item.en))
      .map((o) => o.en);
    const otras = rng.shuffle(VOCABULARIO_VISUAL.filter((o) => o.categoria !== item.categoria)).map((o) => o.en);
    const pool = difficulty === 1 ? [...otras, ...misma] : [...misma, ...otras];

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `¿Cómo se dice en inglés?\n\n${item.emoji}`,
        ...buildChoices(rng, item.en, pool),
      },
      fingerprintParts: ['vocabulario_imagen', item.en],
      timeLimitSec: timeLimitFor(ctx.band, difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// 6-8 · Números y colores
// ---------------------------------------------------------------------------

export const numerosColores: ExerciseGenerator = {
  id: 'ingles.numeros_colores',
  label: 'Inglés: números y colores',
  pillar: 'lenguaje',
  idioma: 'en',
  bands: ['6-8'],
  difficulty: [1, 3],
  generate(ctx) {
    const { rng, difficulty } = ctx;

    if (rng.bool()) {
      const color = rng.pick(COLORES);
      return {
        prompt: {
          kind: 'multiple_choice',
          stem: '¿De qué color es esta figura en inglés?',
          ilustracion: { tipo: 'figuras', filas: [[{ forma: 'circulo', color: color.color }]] },
          ...buildChoices(rng, color.en, rng.shuffle(COLORES.filter((c) => c !== color).map((c) => c.en))),
        },
        fingerprintParts: ['color', color.en],
        timeLimitSec: timeLimitFor(ctx.band, difficulty),
      };
    }

    // Hasta el diez en el primer nivel; del once al veinte después, que es
    // donde aparecen las formas irregulares («eleven», «twelve»).
    const numeros = NUMEROS.slice(0, difficulty === 1 ? 10 : 20);
    const numero = rng.pick(numeros);
    const otros = rng.shuffle(numeros.filter((n) => n !== numero));

    // En el nivel alto se pide escribirlo: reconocer «seven» es más fácil que
    // elegirlo entre palabras parecidas como «seventeen».
    const escribir = difficulty === 3;

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: escribir
          ? `¿Cómo se escribe ${numero.valor} en inglés?`
          : `¿Qué número es "${numero.en}"?`,
        ...(escribir
          ? buildChoices(rng, numero.en, otros.map((n) => n.en))
          : buildChoices(rng, String(numero.valor), otros.map((n) => String(n.valor)))),
      },
      fingerprintParts: ['numero', numero.valor, escribir ? 'escribir' : 'leer'],
      timeLimitSec: timeLimitFor(ctx.band, difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// 6-8, 9-12 · Saludos y cortesía
// ---------------------------------------------------------------------------

export const saludos: ExerciseGenerator = {
  id: 'ingles.saludos',
  label: 'Inglés: saludos y cortesía',
  pillar: 'lenguaje',
  idioma: 'en',
  bands: ['6-8', '9-12'],
  difficulty: [1, 3],
  generate(ctx) {
    const { rng } = ctx;
    const item = rng.pick(SALUDOS);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `¿Cómo se dice "${item.es}" en inglés?`,
        ...buildChoices(rng, item.en, rng.shuffle(SALUDOS.filter((s) => s !== item).map((s) => s.en))),
      },
      fingerprintParts: ['saludos', item.en],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// 9-12, 13-16 · Verbo «to be»
// ---------------------------------------------------------------------------

export const verboToBe: ExerciseGenerator = {
  id: 'ingles.to_be',
  label: 'Inglés: verbo to be',
  pillar: 'lenguaje',
  idioma: 'en',
  bands: ['9-12', '13-16'],
  difficulty: [1, 3],
  generate(ctx) {
    const { rng, difficulty } = ctx;
    const sujeto = rng.pick(SUJETOS_TO_BE);
    const complemento = rng.pick(COMPLEMENTOS_TO_BE);

    // En el nivel alto, la pregunta: el verbo sube al principio y es el paso
    // que un hispanohablante omite («They are at home?»).
    const pregunta = difficulty === 3;
    const correcta = pregunta ? capitalizar(sujeto.verbo) : sujeto.verbo;
    const formas = pregunta ? ['Am', 'Is', 'Are'] : ['am', 'is', 'are'];

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: pregunta
          ? `Completa la pregunta:\n\n___ ${sujeto.enPregunta} ${complemento}?`
          : `Completa la oración:\n\n${sujeto.sujeto} ___ ${complemento}.`,
        ...buildChoices(rng, correcta, formas, 3),
      },
      fingerprintParts: ['to_be', sujeto.sujeto, complemento, pregunta ? 'pregunta' : 'afirmacion'],
      timeLimitSec: timeLimitFor(ctx.band, difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// 9-12, 13-16 · Presente simple
// ---------------------------------------------------------------------------

export const presenteSimple: ExerciseGenerator = {
  id: 'ingles.presente_simple',
  label: 'Inglés: presente simple',
  pillar: 'lenguaje',
  idioma: 'en',
  bands: ['9-12', '13-16'],
  difficulty: [1, 4],
  generate(ctx) {
    const { rng } = ctx;
    const verbo = rng.pick(VERBOS);
    const sujeto = rng.pick(SUJETOS_VERBO);
    const adverbio = rng.pick(ADVERBIOS_FRECUENCIA);
    const correcta = sujeto.tercera ? verbo.tercera : verbo.base;

    return {
      prompt: {
        kind: 'multiple_choice',
        // La consigna nombra el tiempo verbal: con «always» un pasado también
        // sería gramatical, y el reto dejaría de tener una sola respuesta.
        stem: `Completa en presente simple (algo que pasa normalmente):\n\n${sujeto.sujeto} ${adverbio} ___ ${verbo.complemento}.`,
        ...buildChoices(rng, correcta, [verbo.base, verbo.tercera, verbo.gerundio, verbo.pasado]),
      },
      fingerprintParts: ['presente', verbo.base, sujeto.sujeto, adverbio],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// 9-12, 13-16 · Pasado simple
// ---------------------------------------------------------------------------

export const pasadoSimple: ExerciseGenerator = {
  id: 'ingles.pasado_simple',
  label: 'Inglés: pasado simple',
  pillar: 'lenguaje',
  idioma: 'en',
  bands: ['9-12', '13-16'],
  difficulty: [2, 5],
  generate(ctx) {
    const { rng, difficulty } = ctx;
    // Primero la regla (-ed) y luego las excepciones: presentar los irregulares
    // antes de dominar la regla hace que el menor memorice listas sin patrón.
    const verbos = difficulty <= 2 ? VERBOS.filter((v) => !v.irregular) : VERBOS;
    const verbo = rng.pick(verbos);
    const sujeto = rng.pick(SUJETOS_VERBO);
    const marcador = rng.pick(MARCADORES_PASADO);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `Completa en pasado simple:\n\n${sujeto.sujeto} ___ ${verbo.complemento} ${marcador}.`,
        ...buildChoices(rng, verbo.pasado, [verbo.base, verbo.tercera, verbo.gerundio]),
      },
      fingerprintParts: ['pasado', verbo.base, sujeto.sujeto, marcador],
      timeLimitSec: timeLimitFor(ctx.band, difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// 9-12, 13-16 · Preposiciones de lugar
// ---------------------------------------------------------------------------

export const preposiciones: ExerciseGenerator = {
  id: 'ingles.preposiciones',
  label: 'Inglés: preposiciones de lugar',
  pillar: 'lenguaje',
  idioma: 'en',
  bands: ['9-12', '13-16'],
  difficulty: [1, 4],
  generate(ctx) {
    const { rng } = ctx;
    const preposicion = rng.pick(PREPOSICIONES);
    const cosa = rng.pick(COSAS_UBICABLES);
    const lugares = preposicion.en === 'in' ? LUGARES.filter((l) => l.admiteDentro) : LUGARES;
    const lugar = rng.pick(lugares);

    return {
      prompt: {
        kind: 'multiple_choice',
        // La oración en español fija la posición: sin ella, «The ball is ___
        // the box» admitiría varias preposiciones igual de correctas.
        stem: `${cosa.es} está ${preposicion.es} ${lugar.es}.\n\n${cosa.en} is ___ ${lugar.en}.`,
        ...buildChoices(rng, preposicion.en, rng.shuffle(PREPOSICIONES.filter((p) => p !== preposicion).map((p) => p.en))),
      },
      fingerprintParts: ['preposiciones', preposicion.en, cosa.en, lugar.en],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty) + 10,
    };
  },
};

// ---------------------------------------------------------------------------
// 9-12, 13-16 · Traducción de palabras
// ---------------------------------------------------------------------------

export const traduccionPalabra: ExerciseGenerator = {
  id: 'ingles.traduccion_palabra',
  label: 'Inglés: traducción de palabras',
  pillar: 'lenguaje',
  idioma: 'en',
  bands: ['9-12', '13-16'],
  difficulty: [1, 3],
  generate(ctx) {
    const { rng } = ctx;
    const pool = forBand(PALABRAS_TRADUCCION, ctx.band, AGE_BANDS);
    const palabra = rng.pick(pool);
    const otras = rng.shuffle(pool.filter((p) => p !== palabra));

    // Las dos direcciones. Reconocer la palabra en inglés y producirla desde
    // el español son habilidades distintas, y la segunda es la que se olvida.
    const haciaIngles = rng.bool();

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: haciaIngles
          ? `¿Cómo se dice "${palabra.es}" en inglés?`
          : `¿Qué significa "${palabra.en}"?`,
        ...(haciaIngles
          ? buildChoices(rng, palabra.en, otras.map((p) => p.en))
          : buildChoices(rng, palabra.es, otras.map((p) => p.es))),
      },
      fingerprintParts: ['traduccion_palabra', palabra.en, haciaIngles ? 'es-en' : 'en-es'],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// 9-12, 13-16 · Traducción de oraciones
// ---------------------------------------------------------------------------

export const traduccionOracion: ExerciseGenerator = {
  id: 'ingles.traduccion_oracion',
  label: 'Inglés: traducción de oraciones',
  pillar: 'lenguaje',
  idioma: 'en',
  bands: ['9-12', '13-16'],
  difficulty: [3, 5],
  generate(ctx) {
    const { rng } = ctx;
    const oracion = rng.pick(forBand(ORACIONES_TRADUCCION, ctx.band, AGE_BANDS));

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `¿Cuál es la traducción correcta?\n\n${oracion.es}`,
        ...buildChoices(rng, oracion.correcta, oracion.errores),
      },
      fingerprintParts: ['traduccion_oracion', oracion.es],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty) + 10,
    };
  },
};

// ---------------------------------------------------------------------------
// 13-16 · Falsos amigos
// ---------------------------------------------------------------------------

export const falsosAmigos: ExerciseGenerator = {
  id: 'ingles.falsos_amigos',
  label: 'Inglés: falsos amigos',
  pillar: 'lenguaje',
  idioma: 'en',
  bands: ['13-16'],
  difficulty: [3, 5],
  generate(ctx) {
    const { rng } = ctx;
    const item = rng.pick(FALSOS_AMIGOS);
    const otros = rng.shuffle(FALSOS_AMIGOS.filter((f) => f !== item).map((f) => f.correcto));

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `Cuidado, se parece al español: ¿qué significa "${item.en}"?`,
        // El falso amigo va el primero del pool para que esté siempre entre las
        // opciones: es justo el error que el reto quiere desactivar.
        ...buildChoices(rng, item.correcto, [item.falso, ...otros]),
      },
      fingerprintParts: ['falsos_amigos', item.en],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// 13-16 · Comparativos y superlativos
// ---------------------------------------------------------------------------

export const comparativos: ExerciseGenerator = {
  id: 'ingles.comparativos',
  label: 'Inglés: comparativos y superlativos',
  pillar: 'lenguaje',
  idioma: 'en',
  bands: ['13-16'],
  difficulty: [2, 5],
  generate(ctx) {
    const { rng, difficulty } = ctx;
    const adjetivo = rng.pick(COMPARATIVOS);

    if (difficulty >= 4) {
      return {
        prompt: {
          kind: 'multiple_choice',
          stem: `Completa con el superlativo:\n\n${adjetivo.fraseSuperlativo}`,
          ...buildChoices(rng, adjetivo.superlativo, [adjetivo.superlativoMal, adjetivo.comparativo, adjetivo.base]),
        },
        fingerprintParts: ['superlativo', adjetivo.base],
        timeLimitSec: timeLimitFor(ctx.band, difficulty),
      };
    }

    const [primero, segundo] = rng.pick(adjetivo.pares);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `Completa la comparación:\n\n${primero} is ___ than ${segundo}.`,
        ...buildChoices(rng, adjetivo.comparativo, [adjetivo.comparativoMal, adjetivo.base, adjetivo.superlativo]),
      },
      fingerprintParts: ['comparativo', adjetivo.base, primero],
      timeLimitSec: timeLimitFor(ctx.band, difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// 9-12, 13-16 · Lectura
// ---------------------------------------------------------------------------

export const lectura: ExerciseGenerator = {
  id: 'ingles.lectura',
  label: 'Inglés: comprensión lectora',
  pillar: 'lenguaje',
  idioma: 'en',
  bands: ['9-12', '13-16'],
  difficulty: [3, 5],
  generate(ctx) {
    const { rng } = ctx;
    const item = rng.pick(forBand(LECTURAS, ctx.band, AGE_BANDS));

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `Lee en inglés y responde:\n\n${item.texto}\n\n${item.pregunta}`,
        ...buildChoices(rng, item.correcta, item.distractores),
      },
      fingerprintParts: ['lectura', item.texto],
      // Leer en una segunda lengua es más lento que en la propia.
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty) + 35,
    };
  },
};

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export const ENGLISH_GENERATORS: readonly ExerciseGenerator[] = [
  vocabularioImagen,
  numerosColores,
  saludos,
  verboToBe,
  presenteSimple,
  pasadoSimple,
  preposiciones,
  traduccionPalabra,
  traduccionOracion,
  falsosAmigos,
  comparativos,
  lectura,
];
