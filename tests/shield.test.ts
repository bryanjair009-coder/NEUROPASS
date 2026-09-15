import { readFileSync } from 'node:fs';
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

const OVERLAY = 'modules/neuropass-screentime/android/src/main/java/com/neuropass/screentime/BlockOverlay.kt';
const ESTILO = 'modules/neuropass-screentime/android/src/main/java/com/neuropass/screentime/ShieldStyle.kt';

describe('colores de la pantalla de bloqueo', () => {
  it('usa los mismos fondos y textos que las paletas de TypeScript', () => {
    const theme = leer('src/ui/theme.ts');
    const overlay = leer(OVERLAY);

    const deTs = (nombre: string, bloque: 'paletaDia' | 'paletaNoche'): string => {
      const desde = theme.indexOf(`export const ${bloque}`);
      const trozo = theme.slice(desde, desde + 900);
      const encontrado = trozo.match(new RegExp(`${nombre}: '(#[0-9A-Fa-f]{6})'`));
      if (!encontrado?.[1]) throw new Error(`No se localizó ${nombre} en ${bloque}`);
      return encontrado[1].toUpperCase();
    };

    const deKotlin = (constante: string): string => {
      const encontrado = overlay.match(
        new RegExp(`val ${constante} = Color\\.parseColor\\("(#[0-9A-Fa-f]{6})"\\)`),
      );
      if (!encontrado?.[1]) throw new Error(`No se localizó ${constante} en BlockOverlay.kt`);
      return encontrado[1].toUpperCase();
    };

    expect(deKotlin('FONDO_CLARO')).toBe(deTs('base', 'paletaDia'));
    expect(deKotlin('FONDO_OSCURO')).toBe(deTs('base', 'paletaNoche'));
    expect(deKotlin('TEXTO_CLARO')).toBe(deTs('text', 'paletaDia'));
    expect(deKotlin('TEXTO_OSCURO')).toBe(deTs('text', 'paletaNoche'));
  });

  it('el acento de respaldo son colores de marca reales', () => {
    const theme = leer('src/ui/theme.ts');
    const overlay = leer(OVERLAY);

    const marca = [...theme.matchAll(/: '(#[0-9A-Fa-f]{6})',/g)].map((m) =>
      (m[1] as string).toUpperCase(),
    );
    const respaldo = [...overlay.matchAll(/(?:bubble|action) = Color\.parseColor\("(#[0-9A-Fa-f]{6})"\)/g)].map(
      (m) => (m[1] as string).toUpperCase(),
    );

    expect(respaldo).toHaveLength(2);
    for (const color of respaldo) expect(marca, `${color} no es un color de marca`).toContain(color);
  });

  it('el degradado nativo usa las mismas proporciones que el de la app', () => {
    // Si estas cifras se separan, la burbuja de la pantalla de bloqueo tendría
    // un volumen distinto al de la misma burbuja dentro de la app.
    const estilo = leer(ESTILO);

    expect(estilo).toContain('lighten(color, 0.22f)');
    expect(estilo).toContain('darken(color, 0.18f)');
    expect(estilo).toContain('darken(color, 0.28f)');
    expect(estilo).toContain('lighten(color, 0.16f)');
    expect(estilo).toContain('darken(color, 0.06f)');
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

describe('mensajes de la pantalla de bloqueo', () => {
  it('hay variedad suficiente para no repetirse a diario', () => {
    expect(SHIELD_MESSAGES.length).toBeGreaterThanOrEqual(8);
  });

  it('no hay mensajes duplicados', () => {
    expect(new Set(SHIELD_MESSAGES).size).toBe(SHIELD_MESSAGES.length);
  });

  it('caben en la burbuja', () => {
    // La burbuja mide 250 dp y el texto va a 17 sp. Por encima de ~95
    // caracteres el texto desborda el círculo en pantallas pequeñas.
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
