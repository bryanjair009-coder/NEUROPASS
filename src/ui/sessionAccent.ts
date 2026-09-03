import { hashString } from '@/lib/rng';
import { brand } from '@/ui/theme';

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
 * combinaciones funcionan: lima sobre cian no separa lo suficiente, y el marino
 * sirve de contraste pero apaga la pantalla si le toca a la burbuja. Cada
 * pareja de aquí tiene contraste suficiente entre sí y con el texto blanco.
 */
const PAREJAS: readonly SessionAccent[] = [
  { bubble: brand.morado, action: brand.cian },
  { bubble: brand.lima, action: brand.morado },
  { bubble: brand.cian, action: brand.rosa },
  { bubble: brand.rosa, action: brand.cian },
  { bubble: brand.morado, action: brand.lima },
  { bubble: brand.cian, action: brand.morado },
];

export function sessionAccent(seed: string): SessionAccent {
  return PAREJAS[hashString(seed) % PAREJAS.length] as SessionAccent;
}

/** Acento por omisión, para pantallas que no pertenecen a ninguna sesión. */
export const DEFAULT_ACCENT: SessionAccent = PAREJAS[0] as SessionAccent;
