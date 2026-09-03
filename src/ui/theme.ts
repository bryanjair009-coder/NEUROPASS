import { Platform } from 'react-native';

import type { Pillar } from '@/domain/pillar';

/**
 * Sistema de diseño.
 *
 * NEUROpass tiene dos públicos con necesidades opuestas en el mismo binario:
 * un menor de entre 6 y 16 años, y una madre o padre que quiere entender de un
 * vistazo qué está pasando. En vez de dos temas distintos —que se
 * desincronizan a la primera— hay un solo conjunto de tokens y dos *modos* de
 * composición: el del menor usa las escalas grandes y los acentos de pilar; el
 * del tutor usa las escalas densas y el gris neutro.
 *
 * Hay dos paletas con las mismas claves. Los componentes nunca importan una en
 * concreto: piden la vigente con `useTheme()`, y así el mismo árbol sirve para
 * los dos temas sin duplicar pantallas.
 *
 * El modo claro usa un blanco roto y no #FFFFFF puro: buena parte del uso
 * ocurre de noche y una pantalla a máxima luminosidad en la habitación de un
 * niño es un problema de sueño. El modo oscuro existe por lo mismo, y por eso
 * sigue al sistema de forma predeterminada.
 */

/**
 * Colores de marca. Son los cinco de la guía y se usan como acentos rotatorios
 * en las pantallas del menor (ver `sessionAccent.ts`), no como decoración
 * suelta: cada uno identifica una sesión completa.
 */
export const brand = {
  morado: '#C64FE3',
  cian: '#21BFE3',
  lima: '#8FE016',
  rosa: '#F2137C',
  marino: '#101B3F',
} as const;

export const lightPalette = {
  // Fondos, del lienzo de la app a las superficies elevadas.
  base: '#FAFBFF',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  border: '#E3E7F5',

  text: '#101B3F',
  textMuted: '#5D6789',
  textFaint: '#98A1BE',

  accent: '#C64FE3',
  accentSoft: '#F3E0FA',

  success: '#16A34A',
  successSoft: '#E6F7EC',
  warning: '#D97706',
  danger: '#DC2626',
  dangerSoft: '#FDECEC',

  white: '#FFFFFF',
} as const;

/** Las dos paletas comparten claves; los valores son colores libres, no literales. */
export type Palette = Record<keyof typeof lightPalette, string>;

/**
 * Paleta oscura.
 *
 * No es la clara invertida: los colores de marca se aclaran un poco para no
 * perder saturación sobre fondo oscuro, y los fondos usan un azul muy
 * desaturado en lugar de negro puro, que sobre OLED produce bordes duros donde
 * termina cada tarjeta.
 */
export const darkPalette: Palette = {
  base: '#0B1020',
  surface: '#141A2E',
  surfaceRaised: '#1D2540',
  border: '#2A3454',

  text: '#F2F5FF',
  textMuted: '#9AA4C4',
  textFaint: '#5F6A8C',

  accent: '#D874F0',
  accentSoft: '#2E1B3B',

  success: '#3DD68C',
  successSoft: '#12341F',
  warning: '#FBBF24',
  danger: '#F87171',
  dangerSoft: '#3A1A1A',

  white: '#FFFFFF',
};

/**
 * Un color por pilar. Se usan en el radar de progreso, en la cabecera de cada
 * reto y en el resumen de la sesión, siempre para lo mismo, de modo que el
 * color acabe significando algo para el menor sin necesidad de leerlo.
 */
export const pillarColor: Record<Pillar, string> = {
  matematicas: brand.cian,
  creatividad: brand.rosa,
  memoria: brand.morado,
  logica: brand.lima,
  lenguaje: brand.marino,
};

/** Escala de espaciado en múltiplos de 4. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  mono: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
} as const;

/**
 * Escala del enunciado según la edad. Un niño de seis años que apenas lee
 * necesita cuerpo grande; un adolescente con un texto de comprensión lectora
 * necesita que quepa la pregunta completa sin desplazarse.
 */
export const promptTypeScale = {
  '6-8': { fontSize: 26, lineHeight: 34 },
  '9-12': { fontSize: 21, lineHeight: 29 },
  '13-16': { fontSize: 18, lineHeight: 26 },
} as const;

/**
 * Sombra multiplataforma. En Android `elevation` es lo único que se respeta;
 * en iOS hay que dar los cuatro parámetros o la sombra no aparece.
 */
export function shadow(level: 'sm' | 'md' | 'lg') {
  // Sobre fondo claro una sombra negra opaca se ve sucia: se baja la opacidad y
  // se tiñe de azul marino, que es el color del texto y mantiene la escena fría.
  const config = {
    sm: { elevation: 2, radius: 8, opacity: 0.06, offset: 2 },
    md: { elevation: 5, radius: 16, opacity: 0.1, offset: 6 },
    lg: { elevation: 10, radius: 28, opacity: 0.14, offset: 12 },
  }[level];

  return Platform.select({
    android: { elevation: config.elevation },
    default: {
      shadowColor: brand.marino,
      shadowOpacity: config.opacity,
      shadowRadius: config.radius,
      shadowOffset: { width: 0, height: config.offset },
    },
  });
}

/**
 * Altura mínima de cualquier control táctil.
 *
 * 48 dp es la recomendación de accesibilidad de Material, y aquí no es
 * negociable: el usuario principal es un niño respondiendo a toda velocidad
 * para recuperar su tiempo de juego. Un objetivo pequeño se traduce en
 * respuestas equivocadas que el modelo de maestría interpretaría como falta de
 * conocimiento.
 */
export const MIN_TOUCH_TARGET = 48;
