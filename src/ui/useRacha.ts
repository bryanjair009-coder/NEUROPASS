import { useEffect, useState } from 'react';

import { recentSessions } from '@/data/repositories/progress';
import { dayKeyOf } from '@/engine/economy';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Sesiones que se leen para calcular la racha. Cuenta sesiones y no días, así
 * que la racha visible tiene techo; con varias sesiones al día se alcanza
 * antes, pero una racha de semanas ya no necesita un número exacto para
 * motivar.
 */
const VENTANA = 60;

/**
 * Días seguidos con al menos una sesión terminada.
 *
 * Se deriva del historial que ya existe en lugar de guardarse: una columna
 * nueva sería otro dato del menor que custodiar, y este se puede recalcular.
 * Los días se cortan con la misma hora de reinicio que la economía, para que
 * la racha y los minutos de hoy hablen del mismo «hoy».
 *
 * Hoy sin sesión todavía no rompe la racha: el día no ha terminado. Si fuera
 * así, cada mañana el menor vería su racha a cero hasta que jugara.
 *
 * `sesionesHoy` no se usa para contar: está para que la racha se vuelva a
 * leer cuando termina una sesión, sin tener que remontar la pantalla.
 */
export function useRacha(childId: string | null, dayResetHour: number, sesionesHoy: number): number {
  const [racha, setRacha] = useState(0);

  useEffect(() => {
    if (!childId) return undefined;
    let vigente = true;

    void recentSessions(childId, VENTANA).then((sesiones) => {
      if (!vigente) return;
      const dias = new Set(sesiones.map((sesion) => dayKeyOf(sesion.startedAt, dayResetHour)));
      const ahora = Date.now();

      let cuenta = 0;
      for (let atras = 0; atras < VENTANA; atras += 1) {
        if (dias.has(dayKeyOf(ahora - atras * DIA_MS, dayResetHour))) cuenta += 1;
        else if (atras > 0) break;
      }
      setRacha(cuenta);
    });

    return () => {
      vigente = false;
    };
  }, [childId, dayResetHour, sesionesHoy]);

  return racha;
}
