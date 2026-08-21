/**
 * Franjas horarias protegidas.
 *
 * Estas funciones son puras y viven en `domain` —no junto a su repositorio—
 * por dos motivos: son la regla que decide si el ocio está bloqueado, así que
 * conviene poder probarlas sin base de datos ni dispositivo; y su
 * comportamiento tiene que coincidir exactamente con el de `PolicyEvaluator`
 * en Kotlin y con el de `isWithinProtectedWindow` en Swift, que son
 * reimplementaciones de esta misma lógica. Si aquí cambia algo, cambia en tres
 * sitios.
 */

export interface ScheduleWindow {
  /** Máscara de bits de los días; bit 0 = domingo … bit 6 = sábado. */
  readonly weekdayMask: number;
  /** Minutos desde la medianoche local, inclusivo. */
  readonly startMinute: number;
  /** Minutos desde la medianoche local, exclusivo. */
  readonly endMinute: number;
}

export const ALL_WEEKDAYS = 0b1111111;
export const SCHOOL_DAYS = 0b0111110;
export const WEEKDAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;

export const MINUTES_PER_DAY = 1440;

export class ScheduleValidationError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleValidationError';
  }
}

export function validateWindow(window: ScheduleWindow): void {
  if (!Number.isInteger(window.startMinute) || window.startMinute < 0 || window.startMinute >= MINUTES_PER_DAY) {
    throw new ScheduleValidationError('La hora de inicio está fuera del día');
  }
  if (!Number.isInteger(window.endMinute) || window.endMinute < 0 || window.endMinute > MINUTES_PER_DAY) {
    throw new ScheduleValidationError('La hora de fin está fuera del día');
  }
  if (window.endMinute <= window.startMinute) {
    // Una franja que cruza la medianoche se modela como dos. Admitir fin <
    // inicio obligaría a que los tres consumidores —JS, Kotlin y Swift—
    // recordaran ese caso especial, y basta con que uno lo olvide.
    throw new ScheduleValidationError(
      'La franja debe terminar después de empezar. Para cruzar la medianoche, crea dos franjas.',
    );
  }
  if ((window.weekdayMask & ALL_WEEKDAYS) === 0) {
    throw new ScheduleValidationError('La franja necesita al menos un día de la semana');
  }
}

/** ¿Cae `at` dentro de la franja? El fin es exclusivo. */
export function windowContains(window: ScheduleWindow, at: Date): boolean {
  const weekdayBit = 1 << at.getDay();
  if ((window.weekdayMask & weekdayBit) === 0) return false;

  const minuteOfDay = at.getHours() * 60 + at.getMinutes();
  return minuteOfDay >= window.startMinute && minuteOfDay < window.endMinute;
}

/** Primera franja activa en ese instante, o `null`. */
export function findActiveWindow<T extends ScheduleWindow>(
  windows: readonly T[],
  at: Date,
): T | null {
  return windows.find((window) => windowContains(window, at)) ?? null;
}

export function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60) % 24;
  const minutes = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** "L–V · 07:00 a 14:00" en su forma compacta para la interfaz. */
export function describeWindow(window: ScheduleWindow): string {
  const days = WEEKDAY_LABELS.filter((_, index) => (window.weekdayMask & (1 << index)) !== 0).join('');
  return `${days} · ${formatMinute(window.startMinute)} a ${formatMinute(window.endMinute)}`;
}
