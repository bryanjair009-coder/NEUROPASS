import { AGE_BANDS } from '@/domain/age';
import { buildChoices } from '@/engine/choices';
import {
  ANTONYM_PAIRS,
  CATEGORIES,
  READING_PASSAGES,
  SPELLING_ITEMS,
  SYNONYM_SETS,
  forBand,
} from '@/engine/lexicon';
import { byDifficulty, timeLimitFor } from '@/engine/scale';
import type { ExerciseGenerator } from '@/engine/types';

/**
 * Pilar 5 — Lenguaje.
 *
 * El riesgo específico de este pilar es el distractor accidentalmente válido:
 * un antónimo que también es sinónimo en otra acepción, una grafía alterna
 * correcta, una letra que completa otra palabra real. Por eso los distractores
 * se toman siempre de otro conjunto del corpus (nunca del mismo campo
 * semántico) y las palabras incompletas se validan contra las letras que
 * realmente no aparecen en la palabra.
 */

const PICTURE_WORDS = [
  { emoji: '🍎', word: 'manzana' },
  { emoji: '🐘', word: 'elefante' },
  { emoji: '🌳', word: 'árbol' },
  { emoji: '🚲', word: 'bicicleta' },
  { emoji: '🏠', word: 'casa' },
  { emoji: '⭐', word: 'estrella' },
  { emoji: '🐟', word: 'pez' },
  { emoji: '☂️', word: 'paraguas' },
  { emoji: '🥕', word: 'zanahoria' },
  { emoji: '🦋', word: 'mariposa' },
  { emoji: '🎸', word: 'guitarra' },
  { emoji: '🌙', word: 'luna' },
] as const;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

// ---------------------------------------------------------------------------
// Palabra e imagen
// ---------------------------------------------------------------------------

export const wordPicture: ExerciseGenerator = {
  id: 'lenguaje.palabra_imagen',
  label: 'Palabra e imagen',
  pillar: 'lenguaje',
  bands: ['6-8'],
  difficulty: [1, 2],
  generate(ctx) {
    const { rng } = ctx;
    const item = rng.pick(PICTURE_WORDS);
    const distractors = PICTURE_WORDS.filter((p) => p.word !== item.word).map((p) => p.word);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `¿Qué palabra corresponde a esta imagen?\n\n${item.emoji}`,
        ...buildChoices(rng, item.word, distractors),
      },
      fingerprintParts: ['palabra_imagen', item.word],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Completar palabra
// ---------------------------------------------------------------------------

export const completeWord: ExerciseGenerator = {
  id: 'lenguaje.completar',
  label: 'Completar palabras',
  pillar: 'lenguaje',
  bands: ['6-8', '9-12'],
  difficulty: [1, 3],
  generate(ctx) {
    const { rng, band } = ctx;
    const pool = forBand(CATEGORIES, band, AGE_BANDS)
      .flatMap((c) => c.members)
      .filter((w) => w.length >= 5 && !w.includes(' '));
    const word = rng.pick(pool).toLocaleLowerCase('es');

    const index = rng.int(1, word.length - 2);
    const missing = word[index] as string;
    const masked = `${word.slice(0, index)}_${word.slice(index + 1)}`;

    // Los distractores son letras que no aparecen en la palabra, lo que hace
    // imposible que alguna forme por accidente la misma palabra.
    const absent = ALPHABET.split('').filter((letter) => !word.includes(letter));
    const distractors = rng.sample(absent, 6);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `¿Qué letra falta?\n\n${masked.split('').join(' ')}`,
        ...buildChoices(rng, missing, distractors),
      },
      fingerprintParts: ['completar', word, index],
      timeLimitSec: timeLimitFor(band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Sinónimos
// ---------------------------------------------------------------------------

export const synonyms: ExerciseGenerator = {
  id: 'lenguaje.sinonimo',
  label: 'Sinónimos',
  pillar: 'lenguaje',
  bands: ['9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng } = ctx;
    const pool = forBand(SYNONYM_SETS, ctx.band, AGE_BANDS);
    const set = rng.pick(pool);
    const answer = rng.pick(set.synonyms);

    // Distractores de otros conjuntos: garantizado que no son sinónimos de `word`.
    const distractors = rng.shuffle(
      pool.filter((other) => other !== set).flatMap((other) => [other.word, ...other.synonyms]),
    );

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `¿Cuál palabra significa lo mismo que "${set.word}"?`,
        ...buildChoices(rng, answer, distractors),
      },
      fingerprintParts: ['sinonimo', set.word, answer],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Antónimos
// ---------------------------------------------------------------------------

export const antonyms: ExerciseGenerator = {
  id: 'lenguaje.antonimo',
  label: 'Antónimos',
  pillar: 'lenguaje',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng } = ctx;
    const pool = forBand(ANTONYM_PAIRS, ctx.band, AGE_BANDS);
    const pair = rng.pick(pool);
    const flipped = rng.bool();
    const [prompt, answer] = flipped ? [pair.b, pair.a] : [pair.a, pair.b];

    const distractors = rng
      .shuffle(pool.filter((other) => other !== pair).flatMap((other) => [other.a, other.b]))
      .filter((w) => w !== prompt && w !== answer);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `¿Cuál es lo contrario de "${prompt}"?`,
        ...buildChoices(rng, answer, distractors),
      },
      fingerprintParts: ['antonimo', pair.a, pair.b, flipped ? 'b' : 'a'],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Palabra intrusa
// ---------------------------------------------------------------------------

export const intruderWord: ExerciseGenerator = {
  id: 'lenguaje.intrusa',
  label: 'Palabra intrusa',
  pillar: 'lenguaje',
  bands: ['9-12', '13-16'],
  difficulty: [2, 5],
  generate(ctx) {
    const { rng } = ctx;
    const pool = forBand(SYNONYM_SETS, ctx.band, AGE_BANDS);
    const [set, foreign] = rng.sample(pool, 2);
    if (!set || !foreign) throw new Error('Corpus de sinónimos insuficiente');

    const family = [set.word, ...set.synonyms].slice(0, 3);
    const intruder = rng.pick([foreign.word, ...foreign.synonyms]);
    const options = rng.shuffle([...family, intruder]);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: '¿Cuál palabra no significa lo mismo que las demás?',
        options,
        correctIndex: options.indexOf(intruder),
      },
      fingerprintParts: ['intrusa', set.word, intruder],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Ortografía
// ---------------------------------------------------------------------------

export const spelling: ExerciseGenerator = {
  id: 'lenguaje.ortografia',
  label: 'Ortografía',
  pillar: 'lenguaje',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng } = ctx;
    const pool = forBand(SPELLING_ITEMS, ctx.band, AGE_BANDS);
    const item = rng.pick(pool);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: 'Elige la palabra escrita correctamente:',
        ...buildChoices(rng, item.correct, item.wrong, Math.min(4, item.wrong.length + 1)),
      },
      fingerprintParts: ['ortografia', item.correct],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Comprensión lectora
// ---------------------------------------------------------------------------

export const readingComprehension: ExerciseGenerator = {
  id: 'lenguaje.comprension',
  label: 'Comprensión lectora',
  pillar: 'lenguaje',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng } = ctx;
    const pool = forBand(READING_PASSAGES, ctx.band, AGE_BANDS);
    const passage = rng.pick(pool);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `${passage.text}\n\n${passage.question}`,
        ...buildChoices(rng, passage.correct, passage.distractors),
      },
      fingerprintParts: ['comprension', passage.text],
      // La lectura consume tiempo antes de razonar: se compensa con un margen extra.
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty) + 25,
    };
  },
};

// ---------------------------------------------------------------------------
// Concordancia gramatical
// ---------------------------------------------------------------------------

export const grammarAgreement: ExerciseGenerator = {
  id: 'lenguaje.gramatica',
  label: 'Detección de errores',
  pillar: 'lenguaje',
  bands: ['9-12', '13-16'],
  difficulty: [2, 5],
  generate(ctx) {
    const { rng, difficulty } = ctx;

    const templates = [
      { ok: 'Los libros están sobre la mesa.', bad: ['Los libros esta sobre la mesa.', 'Los libro están sobre la mesa.', 'Los libros están sobre el mesa.'] },
      { ok: 'Ayer fui al parque con mi hermana.', bad: ['Ayer fue al parque con mi hermana.', 'Ayer fui al parque con mi hermano.s', 'Ayer iré al parque con mi hermana ayer.'] },
      { ok: 'Hubo muchos invitados en la fiesta.', bad: ['Hubieron muchos invitados en la fiesta.', 'Hubo mucho invitados en la fiesta.', 'Habían muchos invitados en la fiesta.'] },
      { ok: 'A ella le gustan las películas largas.', bad: ['A ella le gusta las películas largas.', 'A ella les gustan las películas largas.', 'A ella le gustan la película largas.'] },
      { ok: 'Se lo dije a tu mamá esta mañana.', bad: ['Se los dije a tu mamá esta mañana.', 'Le lo dije a tu mamá esta mañana.', 'Se lo dijo a tu mamá esta mañana yo.'] },
      { ok: 'Hace dos años que no lo veo.', bad: ['Hacen dos años que no lo veo.', 'Hace dos años que no los veo a él.', 'Hacía dos años que no lo veré.'] },
      { ok: 'Espero que vengas temprano.', bad: ['Espero que vienes temprano.', 'Espero que vendrás temprano.', 'Espero de que vengas temprano.'] },
      { ok: 'Detrás de mí había una fila enorme.', bad: ['Detrás mío había una fila enorme.', 'Detrás de mí habían una fila enorme.', 'Detrás de mi había una fila enormes.'] },
      { ok: 'Es la casa cuyo techo se cayó.', bad: ['Es la casa que su techo se cayó.', 'Es la casa cuya techo se cayó.', 'Es la casa cuyo se cayó el techo.'] },
      { ok: 'Trajeron los paquetes que pediste.', bad: ['Trajieron los paquetes que pediste.', 'Trajeron los paquete que pediste.', 'Trajeron los paquetes que pedistes.'] },
    ] as const;

    const item = rng.pick(templates);
    const findCorrect = difficulty <= 3;

    if (findCorrect) {
      return {
        prompt: {
          kind: 'multiple_choice',
          stem: '¿Cuál oración está escrita correctamente?',
          ...buildChoices(rng, item.ok, item.bad),
        },
        fingerprintParts: ['gramatica.correcta', item.ok],
        timeLimitSec: timeLimitFor(ctx.band, difficulty) + 10,
      };
    }

    // Invertido: hallar el error entre oraciones correctas exige leerlas todas.
    const others = templates.filter((t) => t !== item).map((t) => t.ok);
    const wrong = rng.pick(item.bad);
    const options = rng.shuffle([wrong, ...rng.sample(others, 3)]);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: '¿Cuál oración tiene un error gramatical?',
        options,
        correctIndex: options.indexOf(wrong),
      },
      fingerprintParts: ['gramatica.error', wrong],
      timeLimitSec: timeLimitFor(ctx.band, difficulty) + 15,
    };
  },
};

// ---------------------------------------------------------------------------
// Completar frases (conectores)
// ---------------------------------------------------------------------------

export const connectors: ExerciseGenerator = {
  id: 'lenguaje.conectores',
  label: 'Conectores',
  pillar: 'lenguaje',
  bands: ['9-12', '13-16'],
  difficulty: [2, 5],
  generate(ctx) {
    const { rng } = ctx;
    const items = [
      { sentence: 'Estudió toda la noche, ___ aprobó el examen.', answer: 'por lo tanto', wrong: ['sin embargo', 'aunque', 'a pesar de que'] },
      { sentence: 'Llovió muchísimo; ___, el partido no se suspendió.', answer: 'sin embargo', wrong: ['por lo tanto', 'además', 'porque'] },
      { sentence: 'No fue a la fiesta ___ estaba enfermo.', answer: 'porque', wrong: ['aunque', 'sin embargo', 'no obstante'] },
      { sentence: '___ es joven, tiene mucha experiencia.', answer: 'Aunque', wrong: ['Porque', 'Por eso', 'Entonces'] },
      { sentence: 'Primero lava la fruta; ___, córtala en trozos.', answer: 'después', wrong: ['antes', 'mientras tanto', 'sin embargo'] },
      { sentence: 'Le gusta el mar; ___, prefiere la montaña para vacacionar.', answer: 'no obstante', wrong: ['por eso', 'así que', 'además'] },
      { sentence: 'Se le hizo tarde ___ perdió el camión.', answer: 'porque', wrong: ['aunque', 'para que', 'sin embargo'] },
      { sentence: 'Guarda bien el recibo ___ necesites hacer un cambio.', answer: 'por si', wrong: ['aunque', 'porque', 'mientras'] },
      { sentence: 'El equipo entrenó mucho; ___, ganó el torneo.', answer: 'en consecuencia', wrong: ['sin embargo', 'a pesar de eso', 'por si acaso'] },
      { sentence: '___ terminó la tarea, salió a jugar.', answer: 'En cuanto', wrong: ['A pesar de que', 'Por si', 'Sin embargo'] },
    ] as const;

    const item = rng.pick(items);
    const count = byDifficulty(ctx.difficulty, [4, 4, 4, 4, 4]);

    return {
      prompt: {
        kind: 'multiple_choice',
        stem: `Completa la oración:\n\n${item.sentence}`,
        ...buildChoices(rng, item.answer, item.wrong, count),
      },
      fingerprintParts: ['conectores', item.sentence],
      timeLimitSec: timeLimitFor(ctx.band, ctx.difficulty),
    };
  },
};

export const LANGUAGE_GENERATORS: readonly ExerciseGenerator[] = [
  wordPicture,
  completeWord,
  synonyms,
  antonyms,
  intruderWord,
  spelling,
  readingComprehension,
  grammarAgreement,
  connectors,
];
