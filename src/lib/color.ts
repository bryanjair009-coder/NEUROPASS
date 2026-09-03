/**
 * Manipulación de color para dar volumen.
 *
 * Una superficie de color plano se lee como una mancha; lo que la convierte en
 * un objeto es el degradado y el canto más oscuro que insinúan de dónde viene
 * la luz. Estas dos funciones bastan para eso y evitan tener que declarar a
 * mano tres variantes de cada color de marca.
 *
 * Se opera en RGB y no en HSL a propósito: para aclarar u oscurecer un color
 * saturado lo justo, mezclar con blanco o negro da un resultado más predecible
 * que rotar la luminosidad, que en los verdes y cianes vira el tono.
 */

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

function parse(hex: string): Rgb {
  const limpio = hex.replace('#', '');
  const completo =
    limpio.length === 3
      ? limpio
          .split('')
          .map((c) => c + c)
          .join('')
      : limpio;

  return {
    r: parseInt(completo.slice(0, 2), 16),
    g: parseInt(completo.slice(2, 4), 16),
    b: parseInt(completo.slice(4, 6), 16),
  };
}

const componente = (valor: number): string =>
  Math.round(Math.min(255, Math.max(0, valor)))
    .toString(16)
    .padStart(2, '0');

const format = ({ r, g, b }: Rgb): string => `#${componente(r)}${componente(g)}${componente(b)}`;

/** Mezcla hacia negro. `amount` va de 0 (sin cambio) a 1 (negro). */
export function darken(hex: string, amount: number): string {
  const { r, g, b } = parse(hex);
  const factor = 1 - Math.min(1, Math.max(0, amount));
  return format({ r: r * factor, g: g * factor, b: b * factor });
}

/** Mezcla hacia blanco. `amount` va de 0 (sin cambio) a 1 (blanco). */
export function lighten(hex: string, amount: number): string {
  const { r, g, b } = parse(hex);
  const t = Math.min(1, Math.max(0, amount));
  return format({
    r: r + (255 - r) * t,
    g: g + (255 - g) * t,
    b: b + (255 - b) * t,
  });
}

/** Mismo color con transparencia, en la notación de ocho dígitos que admite RN. */
export function withAlpha(hex: string, alpha: number): string {
  return `${hex}${componente(Math.min(1, Math.max(0, alpha)) * 255)}`;
}
