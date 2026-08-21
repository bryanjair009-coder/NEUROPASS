import type { MultipleChoicePrompt } from '@/domain/exercise';
import type { Rng } from '@/lib/rng';

export class ChoiceConstructionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChoiceConstructionError';
  }
}

const normalize = (value: string): string => value.trim().toLocaleLowerCase('es');

/**
 * Construye un set de opciones barajado con exactamente un acierto.
 *
 * Reglas que se garantizan aquí (y que se verifican en tests de propiedad para
 * todos los generadores) porque son las que arruinan un test de opción
 * múltiple: sin duplicados, sin distractores idénticos al acierto ignorando
 * mayúsculas y espacios, y siempre `count` opciones. Si el generador no aporta
 * distractores suficientes es un defecto del generador, no algo que se deba
 * disimular rellenando con basura, así que se lanza.
 */
export function buildChoices(
  rng: Rng,
  correct: string,
  distractorPool: readonly string[],
  count = 4,
): Pick<MultipleChoicePrompt, 'options' | 'correctIndex'> {
  if (count < 2) throw new ChoiceConstructionError('Se requieren al menos 2 opciones');

  const seen = new Set([normalize(correct)]);
  const distractors: string[] = [];

  for (const candidate of distractorPool) {
    const key = normalize(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(candidate);
    if (distractors.length === count - 1) break;
  }

  if (distractors.length < count - 1) {
    throw new ChoiceConstructionError(
      `Distractores insuficientes para "${correct}": se necesitan ${count - 1}, ` +
        `hay ${distractors.length} únicos en un pool de ${distractorPool.length}`,
    );
  }

  const options = rng.shuffle([correct, ...distractors]);
  return { options, correctIndex: options.indexOf(correct) };
}

/**
 * Distractores numéricos plausibles: errores que un menor realmente comete
 * (fuera por uno, signo invertido, dígitos transpuestos, orden de operaciones)
 * en lugar de números al azar, que se descartan de un vistazo.
 */
export function numericDistractors(
  rng: Rng,
  correct: number,
  options: { readonly spread?: number; readonly allowNegative?: boolean; readonly integer?: boolean } = {},
): number[] {
  const spread = options.spread ?? Math.max(2, Math.round(Math.abs(correct) * 0.2));
  const allowNegative = options.allowNegative ?? correct < 0;
  const integer = options.integer ?? Number.isInteger(correct);

  const candidates = new Set<number>();
  const offer = (value: number): void => {
    const v = integer ? Math.round(value) : Number(value.toFixed(2));
    if (!Number.isFinite(v)) return;
    if (v === correct) return;
    if (!allowNegative && v < 0) return;
    candidates.add(v);
  };

  offer(correct + 1);
  offer(correct - 1);
  offer(correct + 10);
  offer(correct * 2);
  if (correct !== 0) offer(Math.round(correct / 2));
  offer(transposeDigits(correct));

  // Se completa con ruido acotado alrededor del acierto para llegar al mínimo.
  let guard = 0;
  while (candidates.size < 8 && guard < 64) {
    guard += 1;
    const delta = rng.int(1, spread) * (rng.bool() ? 1 : -1);
    offer(correct + delta);
  }

  return rng.shuffle([...candidates]);
}

function transposeDigits(value: number): number {
  const sign = Math.sign(value) || 1;
  const digits = String(Math.abs(Math.round(value)));
  if (digits.length < 2) return value + 9 * sign;
  const swapped = digits[1]! + digits[0]! + digits.slice(2);
  return sign * Number(swapped);
}

/** Azúcar para generadores numéricos: acierto + distractores ya formateados. */
export function numericChoices(
  rng: Rng,
  correct: number,
  format: (value: number) => string = String,
  count = 4,
  distractorOptions?: Parameters<typeof numericDistractors>[2],
): Pick<MultipleChoicePrompt, 'options' | 'correctIndex'> {
  const pool = numericDistractors(rng, correct, distractorOptions ?? {}).map(format);
  return buildChoices(rng, format(correct), pool, count);
}
