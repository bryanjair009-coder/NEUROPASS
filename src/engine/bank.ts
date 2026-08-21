import rawBank from '../../assets/data/exercise-bank.json';
import { AGE_BANDS, type AgeBand } from '@/domain/age';
import type { Difficulty, Exercise, SequenceToken } from '@/domain/exercise';
import { PILLARS, type Pillar } from '@/domain/pillar';
import { fingerprintOf } from '@/lib/rng';
import { timeLimitFor } from '@/engine/scale';

/**
 * Banco curado de retos escritos a mano.
 *
 * Complementa a los generadores procedurales en lo que estos no pueden cubrir:
 * conocimiento del mundo, humor, referencias culturales y pensamiento lateral.
 * Es finito por definición, así que el planificador lo usa como una fracción
 * acotada de cada sesión (ver session.ts) para que no se agote por repetición.
 *
 * El archivo se genera con `node scripts/build-bank.mjs` y se versiona; aquí
 * solo se valida su forma, porque un banco malformado debe fallar ruidosamente
 * en desarrollo y no producir un reto sin respuesta correcta en producción.
 */

export interface BankItem {
  readonly id: string;
  readonly pillar: Pillar;
  readonly band: AgeBand;
  readonly difficulty: Difficulty;
  readonly kind: 'multiple_choice' | 'sequence_recall';
  readonly stem: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
  readonly instruction?: string;
  readonly sequence?: readonly string[];
  readonly studyMs?: number;
}

export class BankIntegrityError extends Error {
  constructor(message: string) {
    super(`Banco curado corrupto: ${message}`);
    this.name = 'BankIntegrityError';
  }
}

function validate(items: readonly unknown[]): BankItem[] {
  const seen = new Set<string>();

  return items.map((raw, index) => {
    const item = raw as Partial<BankItem>;
    const where = item.id ?? `#${index}`;

    if (!item.id) throw new BankIntegrityError(`${where}: falta id`);
    if (seen.has(item.id)) throw new BankIntegrityError(`${where}: id duplicado`);
    seen.add(item.id);

    if (!item.pillar || !PILLARS.includes(item.pillar)) {
      throw new BankIntegrityError(`${where}: pilar inválido "${item.pillar}"`);
    }
    if (!item.band || !AGE_BANDS.includes(item.band)) {
      throw new BankIntegrityError(`${where}: rango inválido "${item.band}"`);
    }
    if (!item.options || item.options.length < 3) {
      throw new BankIntegrityError(`${where}: se requieren al menos 3 opciones`);
    }
    if (
      item.correctIndex === undefined ||
      item.correctIndex < 0 ||
      item.correctIndex >= item.options.length
    ) {
      throw new BankIntegrityError(`${where}: correctIndex fuera de rango`);
    }
    if (!item.difficulty || item.difficulty < 1 || item.difficulty > 5) {
      throw new BankIntegrityError(`${where}: dificultad fuera de rango`);
    }

    return item as BankItem;
  });
}

let cache: BankItem[] | null = null;

export function bankItems(): readonly BankItem[] {
  cache ??= validate(rawBank as readonly unknown[]);
  return cache;
}

/** Ítems del banco que aplican a un rango y pilar, opcionalmente filtrados por dificultad. */
export function bankItemsFor(
  pillar: Pillar,
  band: AgeBand,
  difficulty?: { readonly min: Difficulty; readonly max: Difficulty },
): readonly BankItem[] {
  return bankItems().filter(
    (item) =>
      item.pillar === pillar &&
      item.band === band &&
      (!difficulty || (item.difficulty >= difficulty.min && item.difficulty <= difficulty.max)),
  );
}

/**
 * Huella de un ítem curado. Se expone aparte de `bankItemToExercise` porque el
 * planificador necesita descartar ítems ya vistos sin construir el reto
 * completo para cada candidato.
 */
export function bankFingerprint(id: string): string {
  return fingerprintOf('bank', id);
}

/** Convierte un ítem curado en la forma que consume la UI. */
export function bankItemToExercise(item: BankItem, instanceIndex: number): Exercise {
  const fingerprint = bankFingerprint(item.id);
  const sourceId = `bank:${item.id}`;

  if (item.kind === 'sequence_recall') {
    const sequence: SequenceToken[] = (item.sequence ?? []).map((label) => ({ label }));
    return {
      id: `${instanceIndex}-${fingerprint}`,
      sourceId,
      pillar: item.pillar,
      band: item.band,
      difficulty: item.difficulty,
      fingerprint,
      timeLimitSec: timeLimitFor(item.band, item.difficulty),
      prompt: {
        kind: 'sequence_recall',
        instruction: item.instruction ?? '',
        sequence,
        studyMs: item.studyMs ?? 3000,
        stem: item.stem,
        options: item.options,
        correctIndex: item.correctIndex,
      },
    };
  }

  return {
    id: `${instanceIndex}-${fingerprint}`,
    sourceId,
    pillar: item.pillar,
    band: item.band,
    difficulty: item.difficulty,
    fingerprint,
    timeLimitSec: timeLimitFor(item.band, item.difficulty),
    prompt: {
      kind: 'multiple_choice',
      stem: item.stem,
      options: item.options,
      correctIndex: item.correctIndex,
    },
  };
}
