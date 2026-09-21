/**
 * Ilustraciones de un reto, descritas como datos.
 *
 * El motor no dibuja nada: describe qué hay que ver —qué figura, de qué color,
 * qué escena— y la interfaz lo convierte en un dibujo. Así el motor sigue
 * siendo puro y ejecutable bajo Node, y la misma descripción podría pintarse
 * con otro estilo sin tocar un solo generador.
 *
 * Antes las figuras eran caracteres de texto (★, ◆, 🟥). Dependían de la
 * tipografía de cada teléfono, se veían pequeñas y planas, y para un niño de
 * seis años un rombo de texto no se parece a un rombo de verdad.
 */

export type FormaFigura =
  | 'estrella'
  | 'corazon'
  | 'rombo'
  | 'triangulo'
  | 'circulo'
  | 'cuadrado'
  | 'cruz'
  | 'luna'
  | 'hexagono'
  | 'gota';

export interface Figura {
  readonly forma: FormaFigura;
  /** Color de relleno en hexadecimal; la interfaz deriva de él el volumen y el borde. */
  readonly color: string;
  /** Solo el contorno. Es un eje de razonamiento en los retos de lógica. */
  readonly hueca?: true;
}

export type ElementoCielo = 'sol' | 'luna' | 'estrellas' | 'nube';

export type ElementoEscena =
  | 'arbol'
  | 'casa'
  | 'montana'
  | 'barco'
  | 'cohete'
  | 'globo'
  | 'cactus'
  | 'flor'
  | 'faro'
  | 'tienda';

export interface Escena {
  readonly cielo: 'dia' | 'atardecer' | 'noche';
  readonly clima?: 'lluvia' | 'nieve';
  readonly suelo: 'pasto' | 'arena' | 'mar' | 'nieve' | 'playa';
  readonly astros: readonly ElementoCielo[];
  /** De izquierda a derecha; tres como máximo para que no se amontonen. */
  readonly elementos: readonly ElementoEscena[];
}

export type Ilustracion =
  /** Filas de figuras. `null` es el hueco que el menor tiene que completar. */
  | { readonly tipo: 'figuras'; readonly filas: readonly (readonly (Figura | null)[])[] }
  | { readonly tipo: 'escena'; readonly escena: Escena };
