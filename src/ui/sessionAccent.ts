import { hashString } from '@/lib/rng';
import { marca } from '@/ui/theme';

/**
 * Acento visual de una sesión.
 *
 * Cada sesión se viste de una pareja de colores de marca: uno para la burbuja
 * del enunciado y otro para los botones de respuesta. Cambian de una sesión a
 * la siguiente, que es lo que pide la guía visual, y no es solo decoración: le
 * da a cada tanda una identidad propia, de modo que resolver retos no se sienta
 * como una lista interminable sino como partidas distinguibles.
 *
 * La pareja se deriva de la semilla de la sesión, igual que los propios retos.
 * Así el color es estable mientras la sesión dura —volver atrás no lo cambia—
 * y reproducible: la misma semilla da la misma sesión y el mismo color.
 */

export interface SessionAccent {
  /** Relleno de la burbuja del enunciado. */
  readonly bubble: string;
  /** Relleno de los botones de respuesta. */
  readonly action: string;
}

/**
 * Parejas admitidas.
 *
 * Se listan a mano en vez de combinarse al azar porque no todas las
 * combinaciones funcionan: lima sobre aqua no separa lo suficiente, y el mango
 * pierde contraste con el texto blanco si le toca a la burbuja. Cada
 * pareja de aquí tiene contraste suficiente entre sí y con el texto blanco.
 */
const PAREJAS: readonly SessionAccent[] = [
  { bubble: marca.morado, action: marca.aqua },
  { bubble: marca.lima, action: marca.morado },
  { bubble: marca.aqua, action: marca.rosa },
  { bubble: marca.rosa, action: marca.aqua },
  { bubble: marca.morado, action: marca.lima },
  { bubble: marca.aqua, action: marca.morado },
];

/**
 * Todas las parejas, para la pantalla de bloqueo nativa.
 *
 * El overlay se dibuja en Kotlin y puede aparecer sin que el proceso de
 * JavaScript exista, así que recibe la lista completa con la política y elige
 * una al azar en cada aparición. Definirla aquí evita tener los colores de
 * marca escritos por duplicado en dos lenguajes.
 */
export const ALL_ACCENTS: readonly SessionAccent[] = PAREJAS;

export function sessionAccent(seed: string): SessionAccent {
  return PAREJAS[hashString(seed) % PAREJAS.length] as SessionAccent;
}

/** Acento por omisión, para pantallas que no pertenecen a ninguna sesión. */
export const DEFAULT_ACCENT: SessionAccent = PAREJAS[0] as SessionAccent;
