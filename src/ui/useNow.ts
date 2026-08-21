import { useEffect, useState } from 'react';

/**
 * Reloj que avanza solo.
 *
 * Varias pantallas necesitan saber la hora actual para decidir qué mostrar
 * —cuánto tiempo queda desbloqueado, si el enfriamiento terminó, si el menor
 * está jugando ahora mismo—. Leer `Date.now()` directamente en el cuerpo del
 * componente es impuro: React puede rerenderizar sin que el valor cambie y, al
 * revés, el valor cambia sin que React se entere, así que la cuenta atrás se
 * congela. Este hook convierte el paso del tiempo en estado, que es lo que
 * React sabe manejar.
 */
export function useNow(intervalMs = 1000): number {
  // Inicializador diferido: se evalúa una sola vez, en el primer montaje, en
  // lugar de en cada render.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
