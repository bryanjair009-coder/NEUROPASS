import { AGE_BANDS } from '@/domain/age';
import type { SequenceToken } from '@/domain/exercise';
import { buildChoices } from '@/engine/choices';
import { FIGURAS_MEMORIA, figurasDeOpciones, type FiguraNombrada } from '@/engine/figuras';
import { CATEGORIES, forBand } from '@/engine/lexicon';
import { byDifficulty, spanFor, studyMsFor, timeLimitFor } from '@/engine/scale';
import type { ExerciseGenerator } from '@/engine/types';

/**
 * Pilar 3 — Memoria.
 *
 * Estos retos usan el tipo `sequence_recall`, que la UI presenta en dos fases:
 * primero muestra `sequence` durante `studyMs` sin permitir responder, y luego
 * la oculta y revela la pregunta. Que el reto sea de dos fases es parte del
 * dato, no de la pantalla: si la UI mostrara ambas cosas a la vez, el ejercicio
 * dejaría de medir memoria. Por eso `studyMs` viaja en el propio ejercicio.
 */

const COLORS = [
  { label: 'Rojo', color: '#EF4444' },
  { label: 'Azul', color: '#3B82F6' },
  { label: 'Verde', color: '#22C55E' },
  { label: 'Amarillo', color: '#EAB308' },
  { label: 'Morado', color: '#A855F7' },
  { label: 'Naranja', color: '#F97316' },
  { label: 'Rosa', color: '#EC4899' },
  { label: 'Café', color: '#92400E' },
] as const;

/** Los colores se muestran como gotas de pintura: una forma concreta se recuerda mejor que un recuadro. */
const GOTAS: readonly FiguraNombrada[] = COLORS.map((c) => ({
  nombre: c.label,
  figura: { forma: 'gota', color: c.color },
}));

const ORDINALS = [
  'primero',
  'segundo',
  'tercero',
  'cuarto',
  'quinto',
  'sexto',
  'séptimo',
  'octavo',
] as const;

// ---------------------------------------------------------------------------
// Secuencia de colores
// ---------------------------------------------------------------------------

export const colorSequence: ExerciseGenerator = {
  id: 'memoria.colores',
  label: 'Secuencia de colores',
  pillar: 'memoria',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng, band, difficulty } = ctx;
    const span = Math.min(spanFor(band, difficulty), GOTAS.length);
    const sequence = rng.sample(GOTAS, span);

    const position = rng.int(0, span - 1);
    const answer = sequence[position];
    if (!answer) throw new Error('Secuencia de colores vacía');

    const distractors = GOTAS.map((c) => c.nombre).filter((nombre) => nombre !== answer.nombre);
    const choices = buildChoices(rng, answer.nombre, distractors);

    return {
      prompt: {
        kind: 'sequence_recall',
        instruction: 'Memoriza el orden de estos colores.',
        sequence: sequence.map<SequenceToken>((c) => ({ label: c.nombre, figura: c.figura })),
        studyMs: studyMsFor(band, span, difficulty),
        stem: `¿Qué color estaba en ${ORDINALS[position]} lugar?`,
        ...choices,
        figurasOpciones: figurasDeOpciones(choices.options, GOTAS),
      },
      fingerprintParts: ['memoria.colores', position, ...sequence.map((c) => c.nombre)],
      timeLimitSec: timeLimitFor(band, difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// ¿Qué desapareció?
// ---------------------------------------------------------------------------

export const missingItem: ExerciseGenerator = {
  id: 'memoria.desaparecido',
  label: 'Qué desapareció',
  pillar: 'memoria',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng, band, difficulty } = ctx;
    const span = Math.min(spanFor(band, difficulty) + 1, FIGURAS_MEMORIA.length);
    const sequence = rng.sample(FIGURAS_MEMORIA, span);

    const removedIndex = rng.int(0, span - 1);
    const removed = sequence[removedIndex];
    if (!removed) throw new Error('Conjunto de figuras vacío');

    // El resto se muestra barajado: si conservara el orden, bastaría con
    // comparar posiciones en lugar de recordar el conjunto.
    const remaining = rng.shuffle(sequence.filter((_, i) => i !== removedIndex));
    const distractors = sequence.filter((s) => s !== removed).map((s) => s.nombre);
    const choices = buildChoices(rng, removed.nombre, distractors, Math.min(4, span));

    return {
      prompt: {
        kind: 'sequence_recall',
        instruction: 'Observa bien todas estas figuras.',
        sequence: sequence.map<SequenceToken>((f) => ({ label: f.nombre, figura: f.figura })),
        studyMs: studyMsFor(band, span, difficulty),
        stem: 'Ahora quedan estas figuras. ¿Cuál desapareció?',
        ilustracion: { tipo: 'figuras', filas: [remaining.map((f) => f.figura)] },
        ...choices,
        figurasOpciones: figurasDeOpciones(choices.options, FIGURAS_MEMORIA),
      },
      fingerprintParts: ['memoria.desaparecido', removed.nombre, ...sequence.map((f) => f.nombre).sort()],
      timeLimitSec: timeLimitFor(band, difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Pares asociados
// ---------------------------------------------------------------------------

export const pairedAssociates: ExerciseGenerator = {
  id: 'memoria.pares',
  label: 'Pares asociados',
  pillar: 'memoria',
  bands: ['9-12', '13-16'],
  difficulty: [2, 5],
  generate(ctx) {
    const { rng, band, difficulty } = ctx;
    const pairCount = byDifficulty(difficulty, [2, 3, 3, 4, 5]);

    const pool = forBand(CATEGORIES, band, AGE_BANDS);
    const words = rng.sample(pool.flatMap((c) => c.members), pairCount);
    const figuras = rng.sample(FIGURAS_MEMORIA, pairCount);

    const pairs = words.map((word, i) => ({ word, figura: figuras[i] as FiguraNombrada }));
    const asked = rng.pick(pairs);
    const distractors = pairs.filter((p) => p !== asked).map((p) => p.figura.nombre);
    // Se completa con figuras que nunca aparecieron: castiga adivinar por descarte.
    const unseen = FIGURAS_MEMORIA.filter((f) => !figuras.includes(f)).map((f) => f.nombre);
    const choices = buildChoices(rng, asked.figura.nombre, [...distractors, ...unseen]);

    return {
      prompt: {
        kind: 'sequence_recall',
        instruction: 'Memoriza qué figura va con cada palabra.',
        sequence: pairs.map<SequenceToken>((p) => ({ label: p.word, figura: p.figura.figura })),
        studyMs: studyMsFor(band, pairCount, difficulty) + 600 * pairCount,
        stem: `¿Qué figura iba con "${asked.word}"?`,
        ...choices,
        figurasOpciones: figurasDeOpciones(choices.options, FIGURAS_MEMORIA),
      },
      fingerprintParts: ['memoria.pares', asked.word, ...pairs.map((p) => `${p.word}:${p.figura.nombre}`).sort()],
      timeLimitSec: timeLimitFor(band, difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Amplitud de dígitos (directa e inversa)
// ---------------------------------------------------------------------------

export const digitSpan: ExerciseGenerator = {
  id: 'memoria.digitos',
  label: 'Amplitud de dígitos',
  pillar: 'memoria',
  bands: ['6-8', '9-12', '13-16'],
  difficulty: [1, 5],
  generate(ctx) {
    const { rng, band, difficulty } = ctx;
    const span = Math.min(spanFor(band, difficulty) + 1, 8);
    // Dígitos sin repetición: repetirlos convierte la tarea en otra cosa.
    const digits = rng.sample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], span);

    // La versión inversa exige manipular lo memorizado, no solo retenerlo:
    // es memoria de trabajo, y por eso se reserva a los niveles altos.
    const reversed = difficulty >= 4 && band !== '6-8';
    const answer = (reversed ? digits.slice().reverse() : digits).join('');

    const distractors = new Set<string>();
    distractors.add(digits.slice().reverse().join(''));
    distractors.add(digits.join(''));
    for (let i = 0; i < 12 && distractors.size < 6; i += 1) {
      distractors.add(rng.shuffle(digits).join(''));
    }
    distractors.delete(answer);

    return {
      prompt: {
        kind: 'sequence_recall',
        instruction: 'Memoriza estos números en orden.',
        sequence: digits.map<SequenceToken>((d) => ({ label: String(d) })),
        studyMs: studyMsFor(band, span, difficulty),
        stem: reversed ? '¿Cuál era la secuencia al revés?' : '¿Cuál era la secuencia?',
        ...buildChoices(rng, answer, [...distractors]),
      },
      fingerprintParts: ['memoria.digitos', reversed ? 'inv' : 'dir', ...digits],
      timeLimitSec: timeLimitFor(band, difficulty),
    };
  },
};

// ---------------------------------------------------------------------------
// Actualización en memoria de trabajo
// ---------------------------------------------------------------------------

export const workingMemoryUpdate: ExerciseGenerator = {
  id: 'memoria.actualizacion',
  label: 'Memoria de trabajo',
  pillar: 'memoria',
  bands: ['9-12', '13-16'],
  difficulty: [3, 5],
  generate(ctx) {
    const { rng, band, difficulty } = ctx;
    const initialCount = byDifficulty(difficulty, [3, 3, 3, 4, 4]);
    const operations = byDifficulty(difficulty, [1, 1, 2, 2, 3]);

    const pool = forBand(CATEGORIES, band, AGE_BANDS).flatMap((c) => c.members);
    const universe = rng.sample(pool, initialCount + operations + 3);
    const initial = universe.slice(0, initialCount);
    const spare = universe.slice(initialCount);

    const current = initial.slice();
    const steps: string[] = [];
    let spareIndex = 0;

    for (let i = 0; i < operations; i += 1) {
      // Se quita solo si quedan al menos dos elementos, para no vaciar la lista.
      const remove = current.length > 1 && rng.bool(0.5);
      if (remove) {
        const victim = rng.pick(current);
        current.splice(current.indexOf(victim), 1);
        steps.push(`quita "${victim}"`);
      } else {
        const added = spare[spareIndex] as string;
        spareIndex += 1;
        current.push(added);
        steps.push(`agrega "${added}"`);
      }
    }

    const answer = String(current.length);
    const distractors = [
      String(initialCount),
      String(current.length + 1),
      String(current.length - 1),
      String(initialCount + operations),
    ].filter((d) => d !== answer && Number(d) >= 0);

    return {
      prompt: {
        kind: 'sequence_recall',
        instruction: 'Memoriza esta lista.',
        sequence: initial.map<SequenceToken>((label) => ({ label })),
        studyMs: studyMsFor(band, initialCount, difficulty),
        stem: `Ahora ${steps.join(', luego ')}.\n\n¿Cuántos elementos quedan en la lista?`,
        ...buildChoices(rng, answer, distractors),
        hint: 'Lleva la cuenta paso a paso, sin volver a la lista original.',
      },
      fingerprintParts: ['memoria.actualizacion', ...initial, ...steps],
      timeLimitSec: timeLimitFor(band, difficulty) + 15,
    };
  },
};

// ---------------------------------------------------------------------------
// Retención de información contextual
// ---------------------------------------------------------------------------

export const contextualRecall: ExerciseGenerator = {
  id: 'memoria.contexto',
  label: 'Retención contextual',
  pillar: 'memoria',
  bands: ['13-16'],
  difficulty: [3, 5],
  generate(ctx) {
    const { rng, band, difficulty } = ctx;

    const subject = rng.pick(['El tren', 'El barco', 'La caravana', 'El autobús']);
    const origin = rng.pick(['Oaxaca', 'Mérida', 'Puebla', 'Colima', 'Durango']);
    const hour = rng.int(5, 11);
    const platform = rng.int(2, 14);
    const passengers = rng.int(3, 9) * 12;

    const facts: readonly SequenceToken[] = [
      { label: `${subject} sale de ${origin}` },
      { label: `Hora de salida: ${hour}:00` },
      { label: `Andén ${platform}` },
      { label: `${passengers} pasajeros` },
    ];

    const question = rng.pick([
      { stem: '¿De qué andén salía?', answer: String(platform), pool: [platform - 1, platform + 1, platform + 3, hour].map(String) },
      { stem: '¿A qué hora salía?', answer: `${hour}:00`, pool: [`${hour + 1}:00`, `${hour - 1}:00`, `${hour}:30`, `${platform}:00`] },
      { stem: '¿Cuántos pasajeros llevaba?', answer: String(passengers), pool: [passengers + 12, passengers - 12, passengers + 1, platform * 12].map(String) },
      { stem: '¿De dónde salía?', answer: origin, pool: ['Oaxaca', 'Mérida', 'Puebla', 'Colima', 'Durango'].filter((c) => c !== origin) },
    ] as const);

    return {
      prompt: {
        kind: 'sequence_recall',
        instruction: 'Lee y memoriza estos datos.',
        sequence: facts,
        studyMs: studyMsFor(band, facts.length, difficulty) + 1500,
        stem: question.stem,
        ...buildChoices(rng, question.answer, question.pool.filter((p) => p !== question.answer)),
      },
      fingerprintParts: ['memoria.contexto', subject, origin, hour, platform, passengers, question.stem],
      timeLimitSec: timeLimitFor(band, difficulty),
    };
  },
};

export const MEMORY_GENERATORS: readonly ExerciseGenerator[] = [
  colorSequence,
  missingItem,
  pairedAssociates,
  digitSpan,
  workingMemoryUpdate,
  contextualRecall,
];
