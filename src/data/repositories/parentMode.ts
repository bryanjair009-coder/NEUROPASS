import { getDatabase } from '@/data/db';
import { shiftOnPause, shiftOnResume, type ParentPause } from '@/engine/parentMode';

/**
 * Persistencia del modo adulto.
 *
 * La aritmética vive en `engine/parentMode.ts` y está probada aparte; aquí solo
 * se traduce a filas. El desplazamiento se aplica sobre `time_grants` con una
 * única sentencia, de modo que no existe un estado intermedio en el que el
 * tiempo del menor esté a medio corregir.
 */

interface ParentModeRow {
  child_id: string;
  paused_at: number;
  paused_until: number | null;
}

export async function parentPause(childId: string): Promise<ParentPause | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ParentModeRow>(
    'SELECT child_id, paused_at, paused_until FROM parent_mode WHERE child_id = ?',
    childId,
  );

  if (!row) return null;
  return { pausedAt: row.paused_at, pausedUntil: row.paused_until };
}

/**
 * Desplaza el vencimiento de los permisos vigentes.
 *
 * El filtro usa `expires_at > ?` con el instante de referencia y no con "ahora"
 * a propósito: durante una pausa larga los permisos dejan de estar vigentes
 * respecto al reloj, y filtrarlos por el presente no encontraría ninguno que
 * corregir.
 */
async function shiftGrants(childId: string, deltaMs: number, reference: number): Promise<void> {
  if (deltaMs === 0) return;

  const db = await getDatabase();
  await db.runAsync(
    'UPDATE time_grants SET expires_at = expires_at + ? WHERE child_id = ? AND revoked_at IS NULL AND expires_at > ?',
    deltaMs,
    childId,
    reference,
  );
}

/**
 * Inicia el modo adulto. `durationMinutes` a `null` deja la pausa indefinida.
 *
 * Reiniciar una pausa ya activa no es un caso válido: la interfaz solo ofrece
 * terminarla. Si llegara a ocurrir, se ignora en lugar de acumular
 * desplazamientos, que corrompería el tiempo del menor.
 */
export async function startParentMode(
  childId: string,
  durationMinutes: number | null,
  now = Date.now(),
): Promise<ParentPause> {
  const existente = await parentPause(childId);
  if (existente) return existente;

  const pause: ParentPause = {
    pausedAt: now,
    pausedUntil: durationMinutes === null ? null : now + durationMinutes * 60_000,
  };

  await shiftGrants(childId, shiftOnPause(pause), now);

  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO parent_mode (child_id, paused_at, paused_until) VALUES (?, ?, ?)',
    childId,
    pause.pausedAt,
    pause.pausedUntil,
  );

  return pause;
}

/**
 * Termina el modo adulto y devuelve al menor el tiempo que no llegó a usarse.
 *
 * Se invoca tanto cuando el adulto pulsa "devolver el teléfono" como cuando la
 * app detecta que una pausa acotada ya venció.
 */
export async function endParentMode(childId: string, now = Date.now()): Promise<void> {
  const pause = await parentPause(childId);
  if (!pause) return;

  await shiftGrants(childId, shiftOnResume(pause, now), pause.pausedAt);

  const db = await getDatabase();
  await db.runAsync('DELETE FROM parent_mode WHERE child_id = ?', childId);
}

/**
 * Devuelve la pausa vigente, cerrando antes las que ya vencieron.
 *
 * Es el punto por el que pasa la interfaz: así una pausa acotada se liquida
 * sola —y el tiempo queda corregido— la primera vez que alguien abre la app
 * después de que venciera, sin depender de que nadie pulse nada.
 */
export async function activeParentPause(
  childId: string,
  now = Date.now(),
): Promise<ParentPause | null> {
  const pause = await parentPause(childId);
  if (!pause) return null;

  if (pause.pausedUntil !== null && now >= pause.pausedUntil) {
    await endParentMode(childId, now);
    return null;
  }

  return pause;
}
