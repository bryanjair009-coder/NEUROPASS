import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { darken, lighten } from '@/lib/color';
import { SHIELD_MESSAGES } from '@/ui/shieldMessages';

/**
 * Pantalla de bloqueo.
 *
 * Se dibuja en Kotlin sobre otras aplicaciones, así que no comparte ni una
 * línea de código con el resto de la interfaz: el lenguaje visual está
 * traducido a la API de dibujo de Android. Eso abre la puerta a que las dos
 * versiones se separen sin que nadie lo note, porque la única forma de ver esta
 * pantalla es tener una app bloqueada delante en un teléfono real.
 *
 * Estas pruebas fijan lo que tiene que coincidir.
 */

const REPO_ROOT = join(__dirname, '..');

const leer = (ruta: string): string => readFileSync(join(REPO_ROOT, ruta), 'utf8');

const MODULO = 'modules/neuropass-screentime/android/src/main';
const OVERLAY = `${MODULO}/java/com/neuropass/screentime/BlockOverlay.kt`;
const ESTILO = `${MODULO}/java/com/neuropass/screentime/ShieldStyle.kt`;

const deKotlin = (overlay: string, constante: string): string => {
  const encontrado = overlay.match(
    new RegExp(`val ${constante} = Color\\.parseColor\\("(#[0-9A-Fa-f]{6})"\\)`),
  );
  if (!encontrado?.[1]) throw new Error(`No se localizó ${constante} en BlockOverlay.kt`);
  return encontrado[1].toUpperCase();
};

/** Valor hexadecimal de una clave dentro del bloque `export const <bloque>` de theme.ts. */
const deTs = (theme: string, bloque: 'marca' | 'paletaDia' | 'paletaNoche', nombre: string): string => {
  const desde = theme.indexOf(`export const ${bloque}`);
  const trozo = theme.slice(desde, desde + 900);
  const encontrado = trozo.match(new RegExp(`\\b${nombre}: '(#[0-9A-Fa-f]{6})'`));
  if (!encontrado?.[1]) throw new Error(`No se localizó ${nombre} en ${bloque}`);
  return encontrado[1].toUpperCase();
};

describe('colores de la pantalla de bloqueo', () => {
  it('usa los mismos fondos y textos que las paletas de TypeScript', () => {
    const theme = leer('src/ui/theme.ts');
    const overlay = leer(OVERLAY);

    expect(deKotlin(overlay, 'FONDO_CLARO')).toBe(deTs(theme, 'paletaDia', 'base'));
    expect(deKotlin(overlay, 'FONDO_OSCURO')).toBe(deTs(theme, 'paletaNoche', 'base'));
    expect(deKotlin(overlay, 'TEXTO_CLARO')).toBe(deTs(theme, 'paletaDia', 'text'));
    expect(deKotlin(overlay, 'TEXTO_OSCURO')).toBe(deTs(theme, 'paletaNoche', 'text'));
    expect(deKotlin(overlay, 'TEXTO_SUAVE_CLARO')).toBe(deTs(theme, 'paletaDia', 'textMuted'));
    expect(deKotlin(overlay, 'TEXTO_SUAVE_OSCURO')).toBe(deTs(theme, 'paletaNoche', 'textMuted'));
  });

  it('la píldora y el antetítulo usan los colores de marca de la app', () => {
    const theme = leer('src/ui/theme.ts');
    const overlay = leer(OVERLAY);

    expect(deKotlin(overlay, 'MORADO')).toBe(deTs(theme, 'marca', 'morado'));
    expect(deKotlin(overlay, 'MORADO_OSC')).toBe(deTs(theme, 'marca', 'moradoOsc'));
    expect(deKotlin(overlay, 'AQUA')).toBe(deTs(theme, 'marca', 'aqua'));
    expect(deKotlin(overlay, 'AQUA_OSC')).toBe(deTs(theme, 'marca', 'aquaOsc'));
  });

  it('la píldora tiene el mismo volumen que el botón principal de la app', () => {
    // Si estas cifras se separan, «Resolver retos» se vería distinto en la
    // pantalla de bloqueo que el mismo botón dentro de la app.
    expect(leer('src/ui/components/primitives.tsx')).toContain('lighten(palette.accent, 0.2)');
    expect(leer(ESTILO)).toContain('lighten(color, 0.2f)');
    expect(leer(OVERLAY)).toContain('ShieldStyle.pill(MORADO, MORADO_OSC');
  });

  it('aclarar y oscurecer coinciden entre los dos lenguajes', () => {
    // La versión de Kotlin replica la aritmética de `lib/color.ts`. Se comprueba
    // sobre la fórmula, que es lo que se puede verificar sin un dispositivo.
    const estilo = leer(ESTILO);

    expect(estilo).toContain('val factor = 1f - amount.coerceIn(0f, 1f)');
    expect(estilo).toContain('(Color.red(color) + (255 - Color.red(color)) * t)');

    // Kotlin tiene que redondear, no truncar: `toInt()` descarta la parte
    // decimal y produce un bit de diferencia respecto a esta implementación.
    expect(estilo).toContain('.roundToInt()');
    expect(estilo).not.toContain('* factor).toInt()');

    // Valores de referencia de la implementación de TypeScript.
    expect(darken('#C64FE3', 0.28)).toBe('#8f39a3');
    expect(lighten('#21BFE3', 0.16)).toBe('#45c9e7');
  });
});

describe('AXO en la pantalla de bloqueo', () => {
  it('el recorte y la tipografía existen en los recursos del módulo', () => {
    // Una referencia a un recurso que no está no falla hasta compilar en la
    // nube, y el fallo llega veinte minutos después.
    const overlay = leer(OVERLAY);

    expect(overlay).toContain('R.drawable.neuropass_axo_reto');
    expect(existsSync(join(REPO_ROOT, MODULO, 'res/drawable-nodpi/neuropass_axo_reto.png'))).toBe(true);

    expect(overlay).toContain('R.font.neuropass_baloo2_bold');
    expect(existsSync(join(REPO_ROOT, MODULO, 'res/font/neuropass_baloo2_bold.ttf'))).toBe(true);
  });

  it('durante un horario protegido no ofrece el atajo a los retos', () => {
    const overlay = leer(OVERLAY);
    expect(overlay).toContain('if (!protegido) {');
  });
});

describe('mensajes de la pantalla de bloqueo', () => {
  it('hay variedad suficiente para no repetirse a diario', () => {
    expect(SHIELD_MESSAGES.length).toBeGreaterThanOrEqual(8);
  });

  it('no hay mensajes duplicados', () => {
    expect(new Set(SHIELD_MESSAGES).size).toBe(SHIELD_MESSAGES.length);
  });

  it('caben bajo AXO sin empujar el botón fuera de la pantalla', () => {
    // El mensaje va a 25 sp en un ancho máximo de 290 dp. Por encima de ~95
    // caracteres ocupa cinco líneas, y en un teléfono pequeño la píldora de
    // «Resolver retos» queda por debajo del borde.
    for (const mensaje of SHIELD_MESSAGES) {
      expect(mensaje.length, mensaje).toBeLessThanOrEqual(95);
    }
  });

  it('ninguno culpa ni prohíbe', () => {
    // El bloqueo es el momento en que la app se juega que el menor la viva como
    // un reto o como un carcelero. Estas palabras la ponen del lado equivocado.
    const prohibidas = /\b(no puedes|castigo|prohibid|se acabó tu|perdiste|mal)\b/i;

    for (const mensaje of SHIELD_MESSAGES) {
      expect(prohibidas.test(mensaje), mensaje).toBe(false);
    }
  });
});
