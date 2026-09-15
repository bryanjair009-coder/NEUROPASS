import { Platform } from 'react-native';

import type { Pillar } from '@/domain/pillar';

/**
 * Sistema de diseño — rediseño AXO.
 *
 * NEUROpass tiene dos públicos con necesidades opuestas en el mismo binario:
 * un menor de entre 6 y 16 años, y una madre o padre que quiere entender de un
 * vistazo qué está pasando. En vez de dos temas distintos —que se
 * desincronizan a la primera— hay un solo conjunto de tokens y dos *modos* de
 * composición: el del menor usa las escalas grandes y los acentos de pilar; el
 * del tutor usa las escalas densas y los tonos neutros.
 *
 * Hay dos paletas con las mismas claves. Los componentes nunca importan una en
 * concreto: piden la vigente con `useTheme()`, y así el mismo árbol sirve para
 * los dos temas sin duplicar pantallas.
 *
 * La paleta se deriva de AXO —morado y aqua— y se organiza en fondos pastel con
 * contenidos saturados encima: eso da contraste suficiente sin la dureza del
 * blanco puro, que en la habitación de un niño de noche es un problema de sueño.
 * Por la misma razón el tema noche no es decorativo: buena parte del uso ocurre
 * a oscuras, y el tema sigue al sistema de forma predeterminada.
 */

/**
 * Colores de marca, idénticos en los dos temas.
 *
 * Cada color tiene su variante oscura. No es un adorno: es el canto inferior de
 * las píldoras y el color de texto del pilar sobre fondo claro, donde el tono
 * saturado original no alcanza contraste legible.
 */
export const marca = {
  morado: '#7C5FFF',
  moradoOsc: '#5B3FE0',
  aqua: '#22D3EE',
  aquaOsc: '#0E9FBC',
  lima: '#22D79E',
  limaOsc: '#109C71',
  rosa: '#FF5DA0',
  rosaOsc: '#C93B78',
  mango: '#FFAA3C',
  mangoOsc: '#C87A0C',
} as const;

export const paletaDia = {
  base: '#F4F1FF',
  surface: '#FFFFFF',
  surfaceRaised: '#F7F4FF',
  border: 'rgba(124,95,255,0.14)',

  text: '#1A1240',
  textMuted: '#6A5F94',
  textFaint: '#9C94BA',

  accent: marca.morado,
  accentSoft: '#EDE7FF',

  pastelAqua: '#DFF7FD',
  pastelRosa: '#FFE7F3',
  pastelLima: '#E4FBEF',
  pastelMango: '#FFF1DC',

  // El fondo de la sesión arcade es un degradado vertical; se declara como dos
  // paradas porque una paleta de React Native no puede guardar un degradado.
  arcadeFondoArriba: '#F1ECFF',
  arcadeFondoAbajo: '#E7F6FF',
  arcadePanel: '#FFFFFF',
  arcadePista: '#E2DAF7',

  // Texto de las píldoras de respuesta sobre su relleno saturado. De día va en
  // blanco; de noche cambia a un tono muy oscuro del mismo color (ver la paleta
  // nocturna), porque blanco sobre neón en una habitación a oscuras deslumbra.
  tintaPildoraAqua: '#FFFFFF',
  tintaPildoraRosa: '#FFFFFF',
  tintaPildoraLima: '#FFFFFF',
  tintaPildoraMango: '#FFFFFF',

  success: marca.limaOsc,
  successSoft: '#E4FBEF',
  warning: marca.mangoOsc,
  danger: marca.rosaOsc,
  dangerSoft: '#FFE7F3',

  white: '#FFFFFF',
} as const;

/** Las dos paletas comparten claves; los valores son colores libres, no literales. */
export type Palette = Record<keyof typeof paletaDia, string>;

/**
 * Paleta nocturna.
 *
 * No es la diurna invertida: los pasteles se convierten en tintes translúcidos
 * del mismo color sobre el lienzo navy, y los neones de AXO ganan protagonismo
 * porque son lo único que emite luz en la pantalla. Los fondos son un azul muy
 * desaturado y no negro puro, que sobre OLED produce bordes duros donde termina
 * cada tarjeta.
 */
export const paletaNoche: Palette = {
  base: '#070E24',
  surface: '#111B3E',
  surfaceRaised: '#0D1533',
  border: 'rgba(34,211,238,0.20)',

  text: '#EAF2FF',
  textMuted: '#93A2CC',
  textFaint: '#5E6C96',

  accent: marca.morado,
  accentSoft: 'rgba(124,95,255,0.20)',

  pastelAqua: 'rgba(34,211,238,0.16)',
  pastelRosa: 'rgba(255,93,160,0.18)',
  pastelLima: 'rgba(34,215,158,0.17)',
  pastelMango: 'rgba(255,170,60,0.18)',

  arcadeFondoArriba: '#0A1330',
  arcadeFondoAbajo: '#12204A',
  arcadePanel: 'rgba(255,255,255,0.07)',
  arcadePista: 'rgba(255,255,255,0.14)',

  tintaPildoraAqua: '#06253A',
  tintaPildoraRosa: '#3A0A22',
  tintaPildoraLima: '#06301F',
  tintaPildoraMango: '#3A2405',

  success: '#45E0B4',
  successSoft: 'rgba(34,215,158,0.17)',
  warning: '#FFC878',
  danger: '#FF87B6',
  dangerSoft: 'rgba(255,93,160,0.18)',

  white: '#FFFFFF',
};

/**
 * Un color por pilar. Aparece siempre en los mismos sitios —chip del reto, aura
 * de AXO, barra del poder y punto del panel del tutor—, de modo que el color
 * acabe significando algo para el menor sin necesidad de leerlo.
 */
export const pillarColor: Record<Pillar, string> = {
  matematicas: marca.aqua,
  creatividad: marca.rosa,
  memoria: marca.morado,
  logica: marca.lima,
  lenguaje: marca.mango,
};

/** Variante oscurecida del color del pilar, para texto sobre fondo claro. */
export const pillarColorInk: Record<Pillar, string> = {
  matematicas: marca.aquaOsc,
  creatividad: marca.rosaOsc,
  memoria: marca.moradoOsc,
  logica: marca.limaOsc,
  lenguaje: marca.mangoOsc,
};

export type TonoMarca = 'morado' | 'aqua' | 'lima' | 'rosa' | 'mango';

/** Cada tono de marca con su canto, para las superficies con relieve. */
export const tonoMarca: Record<TonoMarca, { readonly base: string; readonly canto: string }> = {
  morado: { base: marca.morado, canto: marca.moradoOsc },
  aqua: { base: marca.aqua, canto: marca.aquaOsc },
  lima: { base: marca.lima, canto: marca.limaOsc },
  rosa: { base: marca.rosa, canto: marca.rosaOsc },
  mango: { base: marca.mango, canto: marca.mangoOsc },
};

/**
 * Color de cada opción de respuesta, en orden, según el pilar del reto.
 *
 * Cuatro colores distintos para que el menor que lee despacio recuerde «la
 * verde» mientras termina de leer. El primero es el del pilar, y la rotación
 * cambia con él para que ninguna posición quede asociada a un color concreto:
 * si la correcta cayera a menudo en la aqua, el color acabaría siendo una pista.
 */
export const opcionesPorPilar: Record<Pillar, readonly TonoMarca[]> = {
  matematicas: ['aqua', 'morado', 'mango', 'lima'],
  logica: ['aqua', 'rosa', 'mango', 'lima'],
  memoria: ['morado', 'aqua', 'rosa', 'mango'],
  lenguaje: ['mango', 'morado', 'aqua', 'lima'],
  creatividad: ['rosa', 'morado', 'lima', 'aqua'],
};

/**
 * Relleno de las opciones una vez revelada la respuesta.
 *
 * El fallo es un rosa suave y no un rojo: el error nunca se dibuja como una
 * alarma. Lo que se ilumina es la correcta; lo demás se apaga.
 */
export const veredicto = {
  acierto: { arriba: '#45E0B4', abajo: '#14B584', canto: '#0B7D5B' },
  fallo: { arriba: '#FFB0D0', abajo: '#FF87B6', canto: marca.rosaOsc },
  descartada: { arriba: '#B7B2CC', abajo: '#9E99B8', canto: '#7E7A96' },
} as const;

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

/** Radios generosos: nada con esquinas duras a la vista de un niño. */
export const radius = {
  sm: 14,
  md: 18,
  lg: 22,
  xl: 28,
  xxl: 32,
  pill: 999,
} as const;

/**
 * Escala tipográfica.
 *
 * Baloo 2 para títulos, enunciados y cifras: sus formas redondas y cerradas son
 * fáciles de decodificar en lectura temprana. Nunito para el cuerpo.
 *
 * El peso va en el nombre de la familia y **nunca** en `fontWeight`. En React
 * Native cada peso de una fuente empaquetada es una familia distinta, y Android
 * ante un `fontWeight` que no reconoce en esa familia la sustituye por la del
 * sistema o sintetiza una negrita falsa.
 */
export const typography = {
  display: { fontSize: 40, lineHeight: 44, fontFamily: 'Baloo2_800ExtraBold' },
  title: { fontSize: 34, lineHeight: 38, fontFamily: 'Baloo2_800ExtraBold' },
  heading: { fontSize: 21, lineHeight: 26, fontFamily: 'Baloo2_800ExtraBold' },
  action: { fontSize: 19, lineHeight: 24, fontFamily: 'Baloo2_700Bold' },
  body: { fontSize: 15, lineHeight: 22, fontFamily: 'Nunito_600SemiBold' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontFamily: 'Nunito_700Bold' },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: 'Nunito_700Bold' },
  micro: { fontSize: 10.5, lineHeight: 14, letterSpacing: 1.2, fontFamily: 'Nunito_700Bold' },
  mono: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
} as const;

/**
 * Escala del enunciado según la edad, con interlineado 1.30 en los tres rangos.
 * Un niño de seis años que apenas lee necesita cuerpo grande; un adolescente con
 * un texto de comprensión lectora necesita que quepa la pregunta sin desplazarse.
 */
export const promptTypeScale = {
  '6-8': { fontSize: 25, lineHeight: 33 },
  '9-12': { fontSize: 21, lineHeight: 27 },
  '13-16': { fontSize: 18, lineHeight: 23 },
} as const;

/**
 * Sombra multiplataforma. En Android `elevation` es lo único que se respeta; en
 * iOS hay que dar los cuatro parámetros o la sombra no aparece.
 *
 * Bajo una tarjeta de color la sombra se tiñe con ese color: una sombra neutra
 * bajo un degradado saturado lo hace parecer recortado y pegado encima.
 */
export function shadow(level: 'sm' | 'md' | 'lg', tinte = '#1A1240') {
  const config = {
    sm: { elevation: 2, radius: 10, opacity: 0.08, offset: 3 },
    md: { elevation: 6, radius: 16, opacity: 0.1, offset: 4 },
    lg: { elevation: 12, radius: 34, opacity: 0.3, offset: 16 },
  }[level];

  return Platform.select({
    android: { elevation: config.elevation },
    default: {
      shadowColor: tinte,
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

/** Alto de los botones principales del menor: por encima del mínimo, a propósito. */
export const ALTO_BOTON_PRINCIPAL = 62;
