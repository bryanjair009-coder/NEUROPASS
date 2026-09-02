/**
 * Formatos de presentación compartidos entre las pantallas del menor y las del
 * tutor. Viven aquí porque duplicarlos lleva a que una pantalla muestre "1:05"
 * y otra "65 min" para el mismo dato.
 */

/**
 * Cuenta atrás legible.
 *
 * Por debajo de una hora se muestran minutos y segundos, que es lo que importa
 * cuando el tiempo se agota. Por encima se muestran horas y minutos: los
 * segundos ahí solo son ruido que cambia sin parar.
 */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}
