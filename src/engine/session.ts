import type { AgeBand } from '@/domain/age';
import type { Difficulty, Exercise } from '@/domain/exercise';
import { PILLARS, type Pillar } from '@/domain/pillar';
import { bankFingerprint, bankItemToExercise, bankItemsFor } from '@/engine/bank';
import { clampToGenerator, generatorsFor, materialize } from '@/engine/catalog';
import { targetDifficulty, type MasteryState } from '@/engine/mastery';
import { Rng } from '@/lib/rng';

/**
 * Planificador de sesiones.
 *
 * Una sesión es una secuencia corta de retos que, al completarse, desbloquea
 * tiempo de ocio. El planificador equilibra cuatro cosas en tensión:
 *
 *  1. **Cobertura** — que los cinco pilares aparezcan, no solo el favorito.
 *  2. **Reto adecuado** — dificultad tomada del modelo de maestría por pilar.
 *  3. **No repetición** — se rechazan huellas vistas recientemente.
 *  4. **Variedad de formato** — un retos abierto como máximo, y una fracción
 *     acotada del banco curado, que es finito.
 *
 * Todo el plan es determinista respecto a `seed`: la misma semilla y el mismo
 * estado producen exactamente la misma sesión.
 */

export interface SessionPlanInput {
  readonly band: AgeBand;
  /** Semilla determinista; en producción se deriva de childId + marca de tiempo. */
  readonly seed: string;
  /** Cantidad de retos. El planificador respeta este número exactamente. */
  readonly size: number;
  readonly mastery: Record<Pillar, MasteryState>;
  /** Pilares habilitados por el tutor; por omisión, los cinco. */
  readonly focusPillars?: readonly Pillar[];
  /** Huellas de retos recientes que deben evitarse. */
  readonly recentFingerprints?: readonly string[];
  /** Proporción objetivo de retos del banco curado (0..1). */
  readonly bankRatio?: number;
  /** Si el tutor deshabilitó los retos de respuesta escrita. */
  readonly allowOpenResponse?: boolean;
}

export interface SessionPlan {
  readonly seed: string;
  readonly band: AgeBand;
  readonly exercises: readonly Exercise[];
}

const DEFAULT_BANK_RATIO = 0.3;
/** Intentos de regeneración antes de aceptar una huella repetida. */
const FINGERPRINT_RETRIES = 12;

export function planSession(input: SessionPlanInput): SessionPlan {
  const {
    band,
    seed,
    size,
    mastery,
    focusPillars,
    recentFingerprints = [],
    bankRatio = DEFAULT_BANK_RATIO,
    allowOpenResponse = true,
  } = input;

  if (size < 1) throw new RangeError('Una sesión necesita al menos un reto');

  const rng = new Rng(seed);
  const pillars = pillarSequence(rng, mastery, focusPillars ?? PILLARS, size);

  const seen = new Set(recentFingerprints);
  const exercises: Exercise[] = [];
  let openResponseUsed = !allowOpenResponse;
  let bankUsed = 0;

  for (let slot = 0; slot < pillars.length; slot += 1) {
    const pillar = pillars[slot] as Pillar;
    const difficulty = targetDifficulty(mastery[pillar] ?? { rating: 850, attempts: 0 });

    const wantsBank = bankUsed / size < bankRatio && rng.bool(bankRatio);
    const exercise =
      (wantsBank ? pickFromBank(rng, pillar, band, difficulty, seen, slot) : null) ??
      pickGenerated(rng, pillar, band, difficulty, seen, slot, openResponseUsed) ??
      pickFromBank(rng, pillar, band, difficulty, seen, slot);

    if (!exercise) {
      // Sin generadores ni ítems para este pilar y rango: se omite el hueco en
      // lugar de repetir a ciegas, y el bucle de relleno lo compensa después.
      continue;
    }

    if (exercise.sourceId.startsWith('bank:')) bankUsed += 1;
    if (exercise.prompt.kind === 'open_response') openResponseUsed = true;

    seen.add(exercise.fingerprint);
    exercises.push(exercise);
  }

  // Relleno: si algún pilar no pudo aportar, se completa con los que sí pueden
  // para que la sesión siempre tenga el tamaño prometido al menor.
  let guard = 0;
  while (exercises.length < size && guard < size * 4) {
    guard += 1;
    const pillar = rng.pick(focusPillars ?? PILLARS);
    const difficulty = targetDifficulty(mastery[pillar] ?? { rating: 850, attempts: 0 });
    const filler =
      pickGenerated(rng, pillar, band, difficulty, seen, exercises.length, openResponseUsed) ??
      pickFromBank(rng, pillar, band, difficulty, seen, exercises.length);
    if (!filler) continue;
    if (filler.prompt.kind === 'open_response') openResponseUsed = true;
    seen.add(filler.fingerprint);
    exercises.push(filler);
  }

  return { seed, band, exercises };
}

/**
 * Orden de pilares de la sesión.
 *
 * Se garantiza cobertura antes que refuerzo: con `size >= 5` aparecen los cinco
 * pilares una vez y solo entonces se reparten los huecos sobrantes, con más
 * peso para los pilares más rezagados. Nunca se colocan dos retos del mismo
 * pilar de forma consecutiva, para que la sesión no se sienta monótona.
 */
function pillarSequence(
  rng: Rng,
  mastery: Record<Pillar, MasteryState>,
  candidates: readonly Pillar[],
  size: number,
): Pillar[] {
  const pool = candidates.length > 0 ? candidates : PILLARS;

  const weightOf = (pillar: Pillar): number => {
    const rating = mastery[pillar]?.rating ?? 850;
    // Cuanto más bajo el rating, mayor el peso; acotado para que un pilar
    // débil reciba atención extra sin monopolizar la sesión.
    return Math.min(3, Math.max(0.6, 1600 / Math.max(400, rating)));
  };

  const chosen: Pillar[] = [];

  if (size >= pool.length) {
    chosen.push(...rng.shuffle(pool));
  } else {
    chosen.push(...weightedSampleWithoutReplacement(rng, pool, weightOf, size));
  }

  while (chosen.length < size) {
    chosen.push(weightedPick(rng, pool, weightOf));
  }

  return spreadAdjacent(chosen.slice(0, size));
}

function weightedPick(rng: Rng, pool: readonly Pillar[], weightOf: (p: Pillar) => number): Pillar {
  const total = pool.reduce((sum, pillar) => sum + weightOf(pillar), 0);
  let ticket = rng.next() * total;
  for (const pillar of pool) {
    ticket -= weightOf(pillar);
    if (ticket <= 0) return pillar;
  }
  return pool[pool.length - 1] as Pillar;
}

function weightedSampleWithoutReplacement(
  rng: Rng,
  pool: readonly Pillar[],
  weightOf: (p: Pillar) => number,
  count: number,
): Pillar[] {
  const remaining = pool.slice();
  const out: Pillar[] = [];
  while (out.length < count && remaining.length > 0) {
    const picked = weightedPick(rng, remaining, weightOf);
    out.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }
  return out;
}

/** Separa repeticiones adyacentes moviendo el duplicado más adelante. */
function spreadAdjacent(sequence: readonly Pillar[]): Pillar[] {
  const out = sequence.slice();
  for (let i = 1; i < out.length; i += 1) {
    if (out[i] !== out[i - 1]) continue;
    const swapWith = out.findIndex((pillar, j) => j > i && pillar !== out[i - 1] && pillar !== out[i + 1]);
    if (swapWith !== -1) {
      [out[i], out[swapWith]] = [out[swapWith] as Pillar, out[i] as Pillar];
    }
  }
  return out;
}

function pickGenerated(
  rng: Rng,
  pillar: Pillar,
  band: AgeBand,
  difficulty: Difficulty,
  seen: ReadonlySet<string>,
  slot: number,
  openResponseUsed: boolean,
): Exercise | null {
  const available = generatorsFor(pillar, band, difficulty);
  if (available.length === 0) return null;

  let fallback: Exercise | null = null;

  for (let attempt = 0; attempt < FINGERPRINT_RETRIES; attempt += 1) {
    const generator = rng.pick(available);
    const candidate = materialize(
      generator,
      band,
      clampToGenerator(generator, difficulty),
      rng.fork(`${pillar}:${slot}:${attempt}`),
      slot,
    );

    if (openResponseUsed && candidate.prompt.kind === 'open_response') continue;
    if (!seen.has(candidate.fingerprint)) return candidate;
    fallback ??= candidate;
  }

  // Todas las variantes generadas ya se habían visto: mejor repetir un reto
  // válido que devolver un hueco. Ocurre solo con catálogos muy pequeños.
  return fallback;
}

function pickFromBank(
  rng: Rng,
  pillar: Pillar,
  band: AgeBand,
  difficulty: Difficulty,
  seen: ReadonlySet<string>,
  slot: number,
): Exercise | null {
  // Se busca primero en una ventana de ±1 nivel; si no hay nada sin repetir,
  // se abre a todo el pilar antes de rendirse.
  const near = bankItemsFor(pillar, band, {
    min: Math.max(1, difficulty - 1) as Difficulty,
    max: Math.min(5, difficulty + 1) as Difficulty,
  });
  const all = bankItemsFor(pillar, band);

  for (const pool of [near, all]) {
    const fresh = pool.filter((item) => !seen.has(bankFingerprint(item.id)));
    if (fresh.length > 0) return bankItemToExercise(rng.pick(fresh), slot);
  }

  return all.length > 0 ? bankItemToExercise(rng.pick(all), slot) : null;
}
