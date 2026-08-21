/**
 * Generación pseudoaleatoria determinista.
 *
 * Todo el motor de ejercicios es una función pura de su semilla: la misma
 * semilla produce exactamente la misma sesión. Eso permite (a) reproducir en un
 * test cualquier sesión que un menor haya visto, (b) auditar una sesión desde
 * el panel del tutor sin almacenar el contenido íntegro de cada reto, y
 * (c) evitar `Math.random()`, cuyo estado no es reproducible entre plataformas.
 */

/** Dispersa una cadena a un entero de 32 bits. Variante de xmur3. */
export function hashString(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Huella corta y estable en base36, apta para comparar e indexar en SQLite. */
export function fingerprintOf(...parts: readonly (string | number)[]): string {
  const joined = parts.join('\u0001');
  // Dos hashes con sales distintas reducen las colisiones a un nivel
  // irrelevante para el tamaño del historial que manejamos (miles de filas).
  const a = hashString(joined);
  const b = hashString(`\u0002${joined}`);
  return a.toString(36).padStart(7, '0') + b.toString(36).padStart(7, '0');
}

export class Rng {
  private state: number;

  constructor(seed: number | string) {
    const numeric = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    // Un estado de cero degenera en una secuencia constante en mulberry32.
    this.state = numeric === 0 ? 0x9e3779b9 : numeric;
  }

  /** Flotante en [0, 1). mulberry32: rápido, 32 bits de estado, buen equidistribución. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entero en [min, max], ambos inclusive. */
  int(min: number, max: number): number {
    if (max < min) throw new RangeError(`Rango invertido: [${min}, ${max}]`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** `true` con la probabilidad indicada (0..1). */
  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /** Un elemento cualquiera de un arreglo no vacío. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick() sobre un arreglo vacío');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Copia barajada (Fisher–Yates); no muta la entrada. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }

  /** `count` elementos distintos, en orden aleatorio. Recorta si pides de más. */
  sample<T>(items: readonly T[], count: number): T[] {
    return this.shuffle(items).slice(0, Math.max(0, Math.min(count, items.length)));
  }

  /** Deriva un generador hijo, independiente pero reproducible desde este. */
  fork(label: string): Rng {
    return new Rng(hashString(`${this.state}:${label}`));
  }
}
