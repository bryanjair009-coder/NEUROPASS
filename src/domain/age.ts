/**
 * Rangos de edad definidos en la especificación pedagógica. NEUROpass nunca
 * almacena la fecha de nacimiento del menor: el padre elige un rango, y solo
 * ese rango se persiste. Es la mínima granularidad que el motor necesita y
 * evita tratar datos personales de un menor (COPPA §312.2 / GDPR art. 4).
 */
export const AGE_BANDS = ['6-8', '9-12', '13-16'] as const;

export type AgeBand = (typeof AGE_BANDS)[number];

export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  '6-8': '6 a 8 años',
  '9-12': '9 a 12 años',
  '13-16': '13 a 16 años',
};

export function isAgeBand(value: string): value is AgeBand {
  return (AGE_BANDS as readonly string[]).includes(value);
}

/** Índice ordinal del rango, útil para escalar dificultad y tiempos de estudio. */
export function ageBandIndex(band: AgeBand): 0 | 1 | 2 {
  return AGE_BANDS.indexOf(band) as 0 | 1 | 2;
}
