import type { Figura, FormaFigura } from '@/domain/ilustracion';

/**
 * Catálogo de figuras con nombre.
 *
 * Cada figura de memoria tiene un color fijo y distinto de las demás: forma y
 * color van juntos, así que el menor recuerda «la estrella amarilla» como una
 * sola unidad. Si el color cambiara entre apariciones, el reto mediría otra
 * cosa. Los colores se eligieron para distinguirse entre sí también con las
 * formas más comunes de daltonismo, apoyándose en la forma.
 */

export interface FiguraNombrada {
  readonly nombre: string;
  readonly figura: Figura;
}

export const COLOR_FIGURA = {
  amarillo: '#FFC23A',
  rosa: '#FF5DA0',
  aqua: '#22D3EE',
  verde: '#22C55E',
  rojo: '#FF5A4E',
  morado: '#7C5FFF',
  naranja: '#FF9F1C',
  plata: '#8FA3BF',
  cafe: '#A0522D',
  azul: '#2F7BFF',
} as const;

export const FIGURAS_MEMORIA: readonly FiguraNombrada[] = [
  { nombre: 'estrella', figura: { forma: 'estrella', color: COLOR_FIGURA.amarillo } },
  { nombre: 'corazón', figura: { forma: 'corazon', color: COLOR_FIGURA.rosa } },
  { nombre: 'rombo', figura: { forma: 'rombo', color: COLOR_FIGURA.aqua } },
  { nombre: 'triángulo', figura: { forma: 'triangulo', color: COLOR_FIGURA.verde } },
  { nombre: 'círculo', figura: { forma: 'circulo', color: COLOR_FIGURA.rojo } },
  { nombre: 'cuadrado', figura: { forma: 'cuadrado', color: COLOR_FIGURA.morado } },
  { nombre: 'cruz', figura: { forma: 'cruz', color: COLOR_FIGURA.naranja } },
  { nombre: 'luna', figura: { forma: 'luna', color: COLOR_FIGURA.plata } },
  { nombre: 'hexágono', figura: { forma: 'hexagono', color: COLOR_FIGURA.cafe } },
  { nombre: 'gota', figura: { forma: 'gota', color: COLOR_FIGURA.azul } },
];

interface FormaLogica {
  readonly forma: FormaFigura;
  readonly nombre: string;
  readonly femenino: boolean;
  readonly color: string;
}

const FORMAS_LOGICA: readonly FormaLogica[] = [
  { forma: 'triangulo', nombre: 'triángulo', femenino: false, color: COLOR_FIGURA.verde },
  { forma: 'circulo', nombre: 'círculo', femenino: false, color: COLOR_FIGURA.rojo },
  { forma: 'cuadrado', nombre: 'cuadrado', femenino: false, color: COLOR_FIGURA.morado },
  { forma: 'rombo', nombre: 'rombo', femenino: false, color: COLOR_FIGURA.aqua },
  { forma: 'estrella', nombre: 'estrella', femenino: true, color: COLOR_FIGURA.amarillo },
];

/**
 * Figuras de lógica en sus dos versiones, llena y hueca. El nombre concuerda
 * en género —«estrella hueca», «rombo hueco»— porque es lo que se lee en voz
 * alta con lector de pantalla.
 */
export const FIGURAS_LOGICA: readonly { readonly llena: FiguraNombrada; readonly hueca: FiguraNombrada }[] =
  FORMAS_LOGICA.map(({ forma, nombre, femenino, color }) => ({
    llena: { nombre: `${nombre} ${femenino ? 'llena' : 'lleno'}`, figura: { forma, color } },
    hueca: { nombre: `${nombre} ${femenino ? 'hueca' : 'hueco'}`, figura: { forma, color, hueca: true } },
  }));

/**
 * Figura de cada opción, en el orden en que quedaron tras barajar. Lanza si
 * una opción no tiene figura: sería un defecto del generador, y una opción
 * sin dibujo entre opciones dibujadas delataría cuál es la distinta.
 */
export function figurasDeOpciones(options: readonly string[], catalogo: readonly FiguraNombrada[]): Figura[] {
  return options.map((opcion) => {
    const encontrada = catalogo.find((item) => item.nombre === opcion);
    if (!encontrada) throw new Error(`La opción "${opcion}" no tiene figura`);
    return encontrada.figura;
  });
}
