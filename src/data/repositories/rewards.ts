import { randomUUID } from 'expo-crypto';

import { getDatabase } from '@/data/db';
import { dayKeyOf, emptyLedger, type DailyLedger, type RewardPolicy } from '@/engine/economy';

/**
 * Libro diario de minutos y permisos de tiempo concedidos.
 *
 * Un "permiso" (`time_grant`) es la unidad que consume la capa nativa: unos
 * minutos con inicio y caducidad. Se guardan como filas inmutables en vez de
 * llevar un contador mutable porque así el tutor puede ver exactamente qué se
 * concedió, cuándo y por qué, y porque un contador que se decrementa se
 * corrompe en cuanto la app muere a mitad de una escritura.
 */

export interface TimeGrant {
  readonly id: string;
  readonly childId: string;
  readonly minutes: number;
  readonly source: 'session' | 'parent';
  readonly grantedAt: number;
  readonly expiresAt: number;
  readonly revokedAt: number | null;
}

export async function getLedger(
  childId: string,
  policy: RewardPolicy,
  now = Date.now(),
): Promise<DailyLedger> {
  const db = await getDatabase();
  const dayKey = dayKeyOf(now, policy.dayResetHour);

  const row = await db.getFirstAsync<{
    day_key: string;
    earned_minutes: number;
    sessions_completed: number;
    last_session_ended_at: number;
  }>(
    `SELECT day_key, earned_minutes, sessions_completed, last_session_ended_at
     FROM daily_ledger WHERE child_id = ? AND day_key = ?`,
    childId,
    dayKey,
  );

  if (!row) return emptyLedger(now, policy);

  return {
    dayKey: row.day_key,
    earnedMinutes: row.earned_minutes,
    sessionsCompleted: row.sessions_completed,
    lastSessionEndedAt: row.last_session_ended_at,
  };
}

export async function saveLedger(childId: string, ledger: DailyLedger): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO daily_ledger (child_id, day_key, earned_minutes, sessions_completed, last_session_ended_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (child_id, day_key) DO UPDATE
       SET earned_minutes = ?, sessions_completed = ?, last_session_ended_at = ?`,
    childId,
    ledger.dayKey,
    ledger.earnedMinutes,
    ledger.sessionsCompleted,
    ledger.lastSessionEndedAt,
    ledger.earnedMinutes,
    ledger.sessionsCompleted,
    ledger.lastSessionEndedAt,
  );
}

/**
 * Registra minutos desbloqueados.
 *
 * La caducidad se cuenta desde el momento de concederlos. Si el menor gana 30
 * minutos y no los usa, se pierden al cabo de la ventana: acumular saldo
 * indefinidamente convertiría la app en una hucha de tiempo de pantalla, que
 * es justo el hábito que pretende evitar.
 */
export async function grantTime(input: {
  childId: string;
  minutes: number;
  source: 'session' | 'parent';
  validForMinutes?: number;
  now?: number;
}): Promise<TimeGrant> {
  const now = input.now ?? Date.now();
  const validFor = input.validForMinutes ?? Math.max(input.minutes, 60);

  const grant: TimeGrant = {
    id: randomUUID(),
    childId: input.childId,
    minutes: input.minutes,
    source: input.source,
    grantedAt: now,
    expiresAt: now + validFor * 60_000,
    revokedAt: null,
  };

  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO time_grants (id, child_id, minutes, source, granted_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    grant.id,
    grant.childId,
    grant.minutes,
    grant.source,
    grant.grantedAt,
    grant.expiresAt,
  );

  return grant;
}

/** Permisos vigentes ahora mismo: ni caducados ni revocados. */
export async function activeGrants(childId: string, now = Date.now()): Promise<TimeGrant[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    child_id: string;
    minutes: number;
    source: string;
    granted_at: number;
    expires_at: number;
    revoked_at: number | null;
  }>(
    `SELECT id, child_id, minutes, source, granted_at, expires_at, revoked_at
     FROM time_grants
     WHERE child_id = ? AND revoked_at IS NULL AND expires_at > ?
     ORDER BY expires_at`,
    childId,
    now,
  );

  return rows.map((row) => ({
    id: row.id,
    childId: row.child_id,
    minutes: row.minutes,
    source: row.source === 'parent' ? 'parent' : 'session',
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  }));
}

/**
 * Instante en el que se agota todo el tiempo desbloqueado, o `null` si no hay
 * nada vigente. Es el único dato que la capa nativa necesita para decidir si
 * levanta el bloqueo.
 */
export async function unlockedUntil(childId: string, now = Date.now()): Promise<number | null> {
  const grants = await activeGrants(childId, now);
  if (grants.length === 0) return null;
  return Math.max(...grants.map((grant) => grant.expiresAt));
}

/** Revoca todos los permisos vigentes; es el "corte inmediato" del tutor. */
export async function revokeActiveGrants(childId: string, now = Date.now()): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'UPDATE time_grants SET revoked_at = ? WHERE child_id = ? AND revoked_at IS NULL AND expires_at > ?',
    now,
    childId,
    now,
  );
  return result.changes;
}

/** Minutos ganados por día en la ventana indicada, para la gráfica del panel. */
export async function earnedByDay(childId: string, days = 14): Promise<{ dayKey: string; minutes: number }[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ day_key: string; earned_minutes: number }>(
    'SELECT day_key, earned_minutes FROM daily_ledger WHERE child_id = ? ORDER BY day_key DESC LIMIT ?',
    childId,
    days,
  );
  return rows.map((row) => ({ dayKey: row.day_key, minutes: row.earned_minutes })).reverse();
}
