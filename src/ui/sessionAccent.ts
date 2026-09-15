import { marca } from '@/ui/theme';

/**
 * Parejas de color de la pantalla de bloqueo nativa.
 *
 * El escudo se viste con una pareja de colores de marca que cambia en cada
 * aparición: uno para la esfera del mensaje y otro para la píldora de acción.
 * La sesión de retos ya no las usa —su color sale del pilar de cada reto—, así
 * que viven aquí solo para el escudo.
 */

export interface SessionAccent {
  /** Relleno de la esfera del mensaje. */
  readonly bubble: string;
  /** Relleno de la píldora de acción. */
  readonly action: string;
}

/**
 * Parejas admitidas.
 *
 * Se listan a mano en vez de combinarse al azar porque no todas las
 * combinaciones funcionan: lima sobre aqua no separa lo suficiente, y el mango
 * pierde contraste con el texto blanco si le toca a la esfera. Cada pareja de
 * aquí tiene contraste suficiente entre sí y con el texto blanco.
 *
 * El overlay se dibuja en Kotlin y puede aparecer sin que el proceso de
 * JavaScript exista, así que recibe la lista completa con la política y elige
 * una al azar en cada aparición. Definirla aquí evita tener los colores de
 * marca escritos por duplicado en dos lenguajes.
 */
export const ALL_ACCENTS: readonly SessionAccent[] = [
  { bubble: marca.morado, action: marca.aqua },
  { bubble: marca.lima, action: marca.morado },
  { bubble: marca.aqua, action: marca.rosa },
  { bubble: marca.rosa, action: marca.aqua },
  { bubble: marca.morado, action: marca.lima },
  { bubble: marca.aqua, action: marca.morado },
];
