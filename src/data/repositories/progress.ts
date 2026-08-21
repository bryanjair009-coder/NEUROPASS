import { randomUUID } from 'expo-crypto';

import type { Attempt } from '@/domain/exercise';
import { PILLARS, isPillar, type Pillar } from '@/domain/pillar';
import { getDatabase } from '@/data/db';
import { INITIAL_MASTERY, updateMastery, type MasteryState } from '@/engine/mastery';
import { masteryScoreOf } from '@/engine/grading';

/**
 * Progreso: maestría por pilar, sesiones e intentos.
 *
 * De cada intento se persiste el resultado, nunca el contenido. La huella
 * basta para no repetir un reto y el `source_id` basta para saber qué destreza
 * se ejercitó; guardar además el enunciado y la opción elegida sería acumular
 * un registro detallado de la actividad de un menor sin ninguna necesidad
 * funcional. Las respuestas escritas son la excepción, y por eso viven aparte.
 */

export interface SessionSummary {
  readonly id: string;
  readonly childId: string;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly grantedMinutes: number;
  readonly correctCount: number;
  readonly totalCount: number;
}

export interface PillarStat {
  readonly pillar: Pillar;
  readonly mastery: MasteryState;
  readonly attemptsLast30Days: number;
  readonly accuracyLast30Days: number | null;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Cuántas huellas recientes se arrastran al planificar. */
const RECENT_FINGERPRINT_WINDOW = 400;

export async function getMastery(childId: string): Promise<Record<Pillar, MasteryState>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ pillar: string; rating: number; attempts: number }>(
    'SELECT pillar, rating, attempts FROM mastery WHERE child_id = ?',
    childId,
  );

  const result = Object.fromEntries(PILLARS.map((pillar) => [pillar, INITIAL_MASTERY])) as Record<
    Pillar,
    MasteryState
  >;

  for (const row of rows) {
    if (!isPillar(row.pillar)) continue;
    result[row.pillar] = { rating: row.rating, attempts: row.attempts };
  }

  return result;
}

/** Huellas de los retos más recientes, para que el planificador no los repita. */
export async function getRecentFingerprints(childId: string): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ fingerprint: string }>(
    'SELECT fingerprint FROM attempts WHERE child_id = ? ORDER BY created_at DESC LIMIT ?',
    childId,
    RECENT_FINGERPRINT_WINDOW,
  );
  return rows.map((row) => row.fingerprint);
}

export async function startSession(childId: string, seed: string): Promise<string> {
  const db = await getDatabase();
  const id = randomUUID();
  await db.runAsync(
    'INSERT INTO sessions (id, child_id, seed, started_at) VALUES (?, ?, ?, ?)',
    id,
    childId,
    seed,
    Date.now(),
  );
  return id;
}

/**
 * Cierra una sesión: guarda los intentos, actualiza la maestría de cada pilar
 * y archiva las respuestas escritas. Todo en una transacción, porque un cierre
 * a medias dejaría minutos concedidos sin el progreso que los justifica.
 */
export async function finishSession(input: {
  sessionId: string;
  childId: string;
  attempts: readonly Attempt[];
  grantedMinutes: number;
}): Promise<void> {
  const { sessionId, childId, attempts, grantedMinutes } = input;
  const db = await getDatabase();
  const now = Date.now();

  const mastery = await getMastery(childId);
  const nextMastery = { ...mastery };

  for (const attempt of attempts) {
    const score = masteryScoreOf(attempt.exercise, attempt.grade);
    const pillar = attempt.exercise.pillar;
    nextMastery[pillar] = updateMastery(nextMastery[pillar], attempt.exercise.difficulty, score);
  }

  const correctCount = attempts.filter(
    (a) => a.grade.outcome === 'correct' || a.grade.outcome === 'accepted',
  ).length;

  await db.withTransactionAsync(async () => {
    for (const attempt of attempts) {
      await db.runAsync(
        `INSERT INTO attempts
           (id, session_id, child_id, source_id, fingerprint, pillar, difficulty, outcome, elapsed_ms, used_hint, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(),
        sessionId,
        childId,
        attempt.exercise.sourceId,
        attempt.exercise.fingerprint,
        attempt.exercise.pillar,
        attempt.exercise.difficulty,
        attempt.grade.outcome,
        attempt.elapsedMs,
        attempt.usedHint ? 1 : 0,
        now,
      );

      if (attempt.exercise.prompt.kind === 'open_response' && attempt.response.kind === 'text') {
        await db.runAsync(
          'INSERT INTO open_responses (id, session_id, child_id, prompt, body, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          randomUUID(),
          sessionId,
          childId,
          attempt.exercise.prompt.stem,
          attempt.response.value,
          now,
        );
      }
    }

    for (const pillar of PILLARS) {
      const state = nextMastery[pillar];
      await db.runAsync(
        `INSERT INTO mastery (child_id, pillar, rating, attempts, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (child_id, pillar) DO UPDATE SET rating = ?, attempts = ?, updated_at = ?`,
        childId,
        pillar,
        state.rating,
        state.attempts,
        now,
        state.rating,
        state.attempts,
        now,
      );
    }

    await db.runAsync(
      `UPDATE sessions SET ended_at = ?, granted_minutes = ?, correct_count = ?, total_count = ? WHERE id = ?`,
      now,
      grantedMinutes,
      correctCount,
      attempts.length,
      sessionId,
    );
  });
}

export async function recentSessions(childId: string, limit = 20): Promise<SessionSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    child_id: string;
    started_at: number;
    ended_at: number | null;
    granted_minutes: number;
    correct_count: number;
    total_count: number;
  }>(
    `SELECT id, child_id, started_at, ended_at, granted_minutes, correct_count, total_count
     FROM sessions WHERE child_id = ? AND ended_at IS NOT NULL
     ORDER BY started_at DESC LIMIT ?`,
    childId,
    limit,
  );

  return rows.map((row) => ({
    id: row.id,
    childId: row.child_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    grantedMinutes: row.granted_minutes,
    correctCount: row.correct_count,
    totalCount: row.total_count,
  }));
}

/** Estadísticas por pilar para el panel del tutor. */
export async function pillarStats(childId: string): Promise<PillarStat[]> {
  const db = await getDatabase();
  const mastery = await getMastery(childId);
  const since = Date.now() - THIRTY_DAYS_MS;

  const rows = await db.getAllAsync<{ pillar: string; total: number; correct: number }>(
    `SELECT pillar,
            COUNT(*) AS total,
            SUM(CASE WHEN outcome = 'correct' THEN 1 ELSE 0 END) AS correct
     FROM attempts
     WHERE child_id = ? AND created_at >= ? AND outcome IN ('correct', 'incorrect')
     GROUP BY pillar`,
    childId,
    since,
  );

  const byPillar = new Map(rows.map((row) => [row.pillar, row]));

  return PILLARS.map((pillar) => {
    const row = byPillar.get(pillar);
    return {
      pillar,
      mastery: mastery[pillar],
      attemptsLast30Days: row?.total ?? 0,
      accuracyLast30Days: row && row.total > 0 ? row.correct / row.total : null,
    };
  });
}

export interface OpenResponseRecord {
  readonly id: string;
  readonly prompt: string;
  readonly body: string;
  readonly createdAt: number;
}

export async function listOpenResponses(childId: string, limit = 50): Promise<OpenResponseRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; prompt: string; body: string; created_at: number }>(
    'SELECT id, prompt, body, created_at FROM open_responses WHERE child_id = ? ORDER BY created_at DESC LIMIT ?',
    childId,
    limit,
  );
  return rows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    body: row.body,
    createdAt: row.created_at,
  }));
}

/** Borra todas las respuestas escritas de un menor sin tocar su progreso. */
export async function deleteOpenResponses(childId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM open_responses WHERE child_id = ?', childId);
}
