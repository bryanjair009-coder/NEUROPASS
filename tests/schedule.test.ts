import { describe, expect, it } from 'vitest';

import {
  ALL_WEEKDAYS,
  SCHOOL_DAYS,
  ScheduleValidationError,
  describeWindow,
  findActiveWindow,
  formatMinute,
  validateWindow,
  windowContains,
  type ScheduleWindow,
} from '@/domain/schedule';

/**
 * Los horarios protegidos son la única regla capaz de anular el tiempo que el
 * menor ya se ganó, así que sus fronteras tienen que estar clavadas: un
 * desfase de un minuto en el borde significa un bloqueo que aparece cuando no
 * debe o que no aparece cuando debería.
 *
 * Esta misma lógica está reimplementada en Kotlin (`PolicyEvaluator`) y en
 * Swift (`isWithinProtectedWindow`). Estos casos son la especificación de
 * referencia de las tres.
 */

const escuela: ScheduleWindow = {
  weekdayMask: SCHOOL_DAYS,
  startMinute: 7 * 60,
  endMinute: 14 * 60,
};

/** 2026-08-21 es viernes; 2026-08-22, sábado. */
const viernes = (hour: number, minute = 0) => new Date(2026, 7, 21, hour, minute);
const sabado = (hour: number, minute = 0) => new Date(2026, 7, 22, hour, minute);

describe('pertenencia a una franja', () => {
  it('incluye el minuto de inicio', () => {
    expect(windowContains(escuela, viernes(7, 0))).toBe(true);
  });

  it('excluye el minuto de fin', () => {
    // El fin exclusivo permite encadenar franjas contiguas (14:00–15:00) sin
    // que se solapen ni dejen un minuto sin cubrir.
    expect(windowContains(escuela, viernes(13, 59))).toBe(true);
    expect(windowContains(escuela, viernes(14, 0))).toBe(false);
  });

  it('excluye lo que queda fuera del horario', () => {
    expect(windowContains(escuela, viernes(6, 59))).toBe(false);
    expect(windowContains(escuela, viernes(20, 0))).toBe(false);
  });

  it('respeta la máscara de días', () => {
    expect(windowContains(escuela, viernes(10))).toBe(true);
    expect(windowContains(escuela, sabado(10))).toBe(false);
  });

  it('una franja de todos los días cubre también el fin de semana', () => {
    const dormir: ScheduleWindow = { weekdayMask: ALL_WEEKDAYS, startMinute: 21 * 60, endMinute: 1439 };
    expect(windowContains(dormir, sabado(22))).toBe(true);
    expect(windowContains(dormir, sabado(20, 59))).toBe(false);
  });

  it('franjas contiguas no se solapan en la frontera', () => {
    const comida: ScheduleWindow = { weekdayMask: ALL_WEEKDAYS, startMinute: 14 * 60, endMinute: 15 * 60 };
    const at = viernes(14, 0);
    expect(windowContains(escuela, at)).toBe(false);
    expect(windowContains(comida, at)).toBe(true);
  });
});

describe('búsqueda de franja activa', () => {
  const comida: ScheduleWindow = { weekdayMask: ALL_WEEKDAYS, startMinute: 14 * 60, endMinute: 15 * 60 };

  it('devuelve la primera franja que aplica', () => {
    expect(findActiveWindow([escuela, comida], viernes(8))).toBe(escuela);
    expect(findActiveWindow([escuela, comida], viernes(14, 30))).toBe(comida);
  });

  it('devuelve null cuando no aplica ninguna', () => {
    expect(findActiveWindow([escuela, comida], viernes(19))).toBeNull();
    expect(findActiveWindow([], viernes(10))).toBeNull();
  });
});

describe('validación', () => {
  it('acepta una franja normal', () => {
    expect(() => validateWindow(escuela)).not.toThrow();
  });

  it('rechaza una franja que termina antes de empezar', () => {
    // Es el caso de "22:00 a 07:00": se modela como dos franjas, no como una
    // que cruza la medianoche.
    expect(() =>
      validateWindow({ weekdayMask: ALL_WEEKDAYS, startMinute: 22 * 60, endMinute: 7 * 60 }),
    ).toThrow(ScheduleValidationError);
  });

  it('rechaza una franja de duración cero', () => {
    expect(() =>
      validateWindow({ weekdayMask: ALL_WEEKDAYS, startMinute: 600, endMinute: 600 }),
    ).toThrow(ScheduleValidationError);
  });

  it('rechaza minutos fuera del día', () => {
    expect(() => validateWindow({ weekdayMask: ALL_WEEKDAYS, startMinute: -1, endMinute: 60 })).toThrow();
    expect(() => validateWindow({ weekdayMask: ALL_WEEKDAYS, startMinute: 0, endMinute: 1441 })).toThrow();
    expect(() => validateWindow({ weekdayMask: ALL_WEEKDAYS, startMinute: 1440, endMinute: 1440 })).toThrow();
  });

  it('rechaza una franja sin ningún día', () => {
    expect(() => validateWindow({ weekdayMask: 0, startMinute: 60, endMinute: 120 })).toThrow(
      ScheduleValidationError,
    );
  });
});

describe('formato', () => {
  it('muestra la hora con dos dígitos', () => {
    expect(formatMinute(0)).toBe('00:00');
    expect(formatMinute(7 * 60 + 5)).toBe('07:05');
    expect(formatMinute(23 * 60 + 59)).toBe('23:59');
  });

  it('describe la franja con sus días', () => {
    expect(describeWindow(escuela)).toBe('LMXJV · 07:00 a 14:00');
    expect(describeWindow({ weekdayMask: ALL_WEEKDAYS, startMinute: 0, endMinute: 60 })).toBe(
      'DLMXJVS · 00:00 a 01:00',
    );
  });
});
