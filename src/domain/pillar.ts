/**
 * Los cinco pilares cognitivos de NEUROpass. El orden importa: se usa para
 * renderizar el radar de progreso y para desempatar en el planificador de
 * sesiones cuando dos pilares tienen la misma prioridad.
 */
export const PILLARS = ['matematicas', 'creatividad', 'memoria', 'logica', 'lenguaje'] as const;

export type Pillar = (typeof PILLARS)[number];

export const PILLAR_LABEL: Record<Pillar, string> = {
  matematicas: 'Matemáticas',
  creatividad: 'Creatividad',
  memoria: 'Memoria',
  logica: 'Lógica',
  lenguaje: 'Lenguaje',
};

export const PILLAR_EMOJI: Record<Pillar, string> = {
  matematicas: '🔢',
  creatividad: '🎨',
  memoria: '🧠',
  logica: '🧩',
  lenguaje: '📖',
};

export function isPillar(value: string): value is Pillar {
  return (PILLARS as readonly string[]).includes(value);
}
