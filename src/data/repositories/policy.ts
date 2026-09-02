import { randomUUID } from 'expo-crypto';

import { describeWindow, findActiveWindow, validateWindow } from '@/domain/schedule';
import { getDatabase } from '@/data/db';

/**
 * Reglas de bloqueo: qué apps se restringen y en qué franjas horarias.
 *
 * Las franjas ("horarios protegidos") tienen prioridad sobre el tiempo ganado.
 * Es deliberado: si el tutor marcó el horario escolar o la hora de dormir,
 * ninguna cantidad de retos resueltos debe abrir esa puerta. Sin esta
 * precedencia la app sería una forma sofisticada de negociar la hora de dormir.
 */

export interface BlockedApp {
  readonly packageName: string;
  readonly appLabel: string;
  readonly addedAt: number;
}

export interface Schedule {
  readonly id: string;
  readonly childId: string;
  readonly label: string;
  /** Máscara de bits de los días; bit 0 = domingo … bit 6 = sábado. */
  readonly weekdayMask: number;
  /** Minutos desde la medianoche local. */
  readonly startMinute: number;
  readonly endMinute: number;
  readonly enabled: boolean;
}

// La lógica pura de franjas vive en `domain/schedule` para poder probarla sin
// base de datos; aquí solo se reexporta lo que consume la interfaz.
export { ALL_WEEKDAYS, SCHOOL_DAYS, WEEKDAY_LABELS, formatMinute } from '@/domain/schedule';

export async function listBlockedApps(childId: string): Promise<BlockedApp[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ package_name: string; app_label: string; added_at: number }>(
    'SELECT package_name, app_label, added_at FROM blocked_apps WHERE child_id = ? ORDER BY app_label',
    childId,
  );
  return rows.map((row) => ({
    packageName: row.package_name,
    appLabel: row.app_label,
    addedAt: row.added_at,
  }));
}

/** Reemplaza el conjunto completo de apps bloqueadas de un menor. */
export async function setBlockedApps(
  childId: string,
  apps: readonly { packageName: string; appLabel: string }[],
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM blocked_apps WHERE child_id = ?', childId);
    for (const app of apps) {
      await db.runAsync(
        'INSERT INTO blocked_apps (child_id, package_name, app_label, added_at) VALUES (?, ?, ?, ?)',
        childId,
        app.packageName,
        app.appLabel,
        now,
      );
    }
  });
}

export async function listSchedules(childId: string): Promise<Schedule[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    child_id: string;
    label: string;
    weekday_mask: number;
    start_minute: number;
    end_minute: number;
    enabled: number;
  }>(
    'SELECT id, child_id, label, weekday_mask, start_minute, end_minute, enabled FROM schedules WHERE child_id = ? ORDER BY start_minute',
    childId,
  );

  return rows.map((row) => ({
    id: row.id,
    childId: row.child_id,
    label: row.label,
    weekdayMask: row.weekday_mask,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    enabled: row.enabled === 1,
  }));
}

export async function upsertSchedule(schedule: Omit<Schedule, 'id'> & { id?: string }): Promise<string> {
  validateSchedule(schedule);

  const db = await getDatabase();
  const id = schedule.id ?? randomUUID();

  await db.runAsync(
    `INSERT INTO schedules (id, child_id, label, weekday_mask, start_minute, end_minute, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE
       SET label = ?, weekday_mask = ?, start_minute = ?, end_minute = ?, enabled = ?`,
    id,
    schedule.childId,
    schedule.label,
    schedule.weekdayMask,
    schedule.startMinute,
    schedule.endMinute,
    schedule.enabled ? 1 : 0,
    schedule.label,
    schedule.weekdayMask,
    schedule.startMinute,
    schedule.endMinute,
    schedule.enabled ? 1 : 0,
  );

  return id;
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM schedules WHERE id = ?', scheduleId);
}

function validateSchedule(schedule: Omit<Schedule, 'id'>): void {
  validateWindow(schedule);
}

/**
 * ¿Hay alguna franja protegida activa en este instante?
 *
 * Quien llama pasa las franjas ya cargadas: así la decisión sigue siendo una
 * función pura y se puede probar sin tocar la base.
 */
export function activeSchedule(schedules: readonly Schedule[], at: Date): Schedule | null {
  return findActiveWindow(schedules.filter((schedule) => schedule.enabled), at);
}

/** Formatea una franja para la interfaz: "LMXJV · 07:00 a 14:00". */
export function describeSchedule(schedule: Schedule): string {
  return describeWindow(schedule);
}

// ---------------------------------------------------------------------------
// Bitácora
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'pin_configurado'
  | 'pin_restablecido'
  | 'menor_creado'
  | 'menor_archivado'
  | 'ajustes_actualizados'
  | 'apps_actualizadas'
  | 'horario_actualizado'
  | 'tiempo_concedido'
  | 'tiempo_revocado'
  | 'datos_borrados'
  | 'datos_exportados'
  | 'modo_adulto_activado'
  | 'modo_adulto_terminado';

/** Registra una acción del tutor. Nunca registra actividad del menor. */
export async function audit(action: AuditAction, detail = '', childId?: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO audit_log (id, child_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)',
    randomUUID(),
    childId ?? null,
    action,
    detail,
    Date.now(),
  );
}

export interface AuditEntry {
  readonly id: string;
  readonly childId: string | null;
  readonly action: AuditAction;
  readonly detail: string;
  readonly createdAt: number;
}

export async function recentAudit(limit = 50): Promise<AuditEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    child_id: string | null;
    action: string;
    detail: string;
    created_at: number;
  }>('SELECT id, child_id, action, detail, created_at FROM audit_log ORDER BY created_at DESC LIMIT ?', limit);

  return rows.map((row) => ({
    id: row.id,
    childId: row.child_id,
    action: row.action as AuditAction,
    detail: row.detail,
    createdAt: row.created_at,
  }));
}
