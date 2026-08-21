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
 * El fondo es oscuro por decisión de producto: buena parte del uso ocurre de
 * noche, y una pantalla blanca a toda luminosidad en la habitación de un niño
 * es un problema de sueño, no de estética.
 */

export const palette = {
  // Fondos, de más profundo a más elevado.
  base: '#0B1020',
  surface: '#141A2E',
  surfaceRaised: '#1D2540',
  border: '#2A3454',

  text: '#F2F5FF',
  textMuted: '#9AA4C4',
  textFaint: '#5F6A8C',

  accent: '#6C5CE7',
  accentSoft: '#8B7BFF',

  success: '#22C55E',
  successSoft: '#0F3D24',
  warning: '#F59E0B',
  danger: '#EF4444',
  dangerSoft: '#3D1618',

  white: '#FFFFFF',
} as const;

/**
 * Un color por pilar. Se usan en el radar de progreso, en la cabecera de cada
 * reto y en el resumen de la sesión, siempre para lo mismo, de modo que el
 * color acabe significando algo para el menor sin necesidad de leerlo.
 */
export const pillarColor: Record<Pillar, string> = {
  matematicas: '#3B82F6',
  creatividad: '#EC4899',
  memoria: '#A855F7',
  logica: '#22C55E',
  lenguaje: '#F59E0B',
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
  const config = {
    sm: { elevation: 2, radius: 6, opacity: 0.18, offset: 2 },
    md: { elevation: 6, radius: 14, opacity: 0.28, offset: 6 },
    lg: { elevation: 12, radius: 26, opacity: 0.38, offset: 12 },
  }[level];

  return Platform.select({
    android: { elevation: config.elevation },
    default: {
      shadowColor: '#000000',
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
