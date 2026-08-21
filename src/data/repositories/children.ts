import { randomUUID } from 'expo-crypto';

import { isAgeBand, type AgeBand } from '@/domain/age';
import { PILLARS, isPillar, type Pillar } from '@/domain/pillar';
import { DEFAULT_REWARD_POLICY, type RewardPolicy } from '@/engine/economy';
import { getDatabase } from '@/data/db';

/**
 * Perfiles de menores y su configuración.
 *
 * `alias` es el nombre con el que el tutor identifica al menor dentro de la
 * app. Es texto libre y por eso nunca se sincroniza ni se exporta sin acción
 * explícita del tutor: la app no puede impedir que alguien escriba ahí el
 * nombre completo, así que trata el campo como si siempre lo fuera.
 */

export interface Child {
  readonly id: string;
  readonly alias: string;
  readonly avatar: string;
  readonly band: AgeBand;
  readonly createdAt: number;
}

export interface ChildSettings {
  readonly childId: string;
  readonly sessionSize: number;
  /** Pilares habilitados; vacío significa "los cinco". */
  readonly focusPillars: readonly Pillar[];
  readonly allowOpenResponse: boolean;
  readonly rewardPolicy: RewardPolicy;
}

interface ChildRow {
  id: string;
  alias: string;
  avatar: string;
  band: string;
  created_at: number;
}

interface SettingsRow {
  child_id: string;
  session_size: number;
  focus_pillars: string;
  allow_open_response: number;
  reward_policy: string;
}

const MIN_SESSION_SIZE = 3;
const MAX_SESSION_SIZE = 15;

export async function listChildren(): Promise<Child[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ChildRow>(
    'SELECT id, alias, avatar, band, created_at FROM children WHERE archived_at IS NULL ORDER BY created_at',
  );
  return rows.map(toChild);
}

export async function getChild(childId: string): Promise<Child | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ChildRow>(
    'SELECT id, alias, avatar, band, created_at FROM children WHERE id = ?',
    childId,
  );
  return row ? toChild(row) : null;
}

export async function createChild(input: {
  alias: string;
  avatar: string;
  band: AgeBand;
}): Promise<Child> {
  const alias = input.alias.trim();
  if (alias.length === 0) throw new Error('El alias no puede estar vacío');
  if (alias.length > 40) throw new Error('El alias es demasiado largo');

  const db = await getDatabase();
  const child: Child = {
    id: randomUUID(),
    alias,
    avatar: input.avatar,
    band: input.band,
    createdAt: Date.now(),
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO children (id, alias, avatar, band, created_at) VALUES (?, ?, ?, ?, ?)',
      child.id,
      child.alias,
      child.avatar,
      child.band,
      child.createdAt,
    );
    await db.runAsync(
      `INSERT INTO child_settings (child_id, session_size, focus_pillars, allow_open_response, reward_policy, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      child.id,
      5,
      '[]',
      1,
      JSON.stringify(DEFAULT_REWARD_POLICY),
      child.createdAt,
    );
    // Una fila de maestría por pilar desde el inicio: evita tener que
    // distinguir después entre "sin datos" y "rating inicial".
    for (const pillar of PILLARS) {
      await db.runAsync(
        'INSERT INTO mastery (child_id, pillar, rating, attempts, updated_at) VALUES (?, ?, ?, 0, ?)',
        child.id,
        pillar,
        850,
        child.createdAt,
      );
    }
  });

  return child;
}

export async function updateChild(
  childId: string,
  patch: { alias?: string; avatar?: string; band?: AgeBand },
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (patch.alias !== undefined) {
    const alias = patch.alias.trim();
    if (alias.length === 0) throw new Error('El alias no puede estar vacío');
    fields.push('alias = ?');
    values.push(alias);
  }
  if (patch.avatar !== undefined) {
    fields.push('avatar = ?');
    values.push(patch.avatar);
  }
  if (patch.band !== undefined) {
    fields.push('band = ?');
    values.push(patch.band);
  }
  if (fields.length === 0) return;

  values.push(childId);
  await db.runAsync(`UPDATE children SET ${fields.join(', ')} WHERE id = ?`, ...values);
}

/**
 * Archiva un perfil sin borrarlo: si el tutor se arrepiente, el progreso sigue
 * ahí. El borrado definitivo es una acción aparte y explícita.
 */
export async function archiveChild(childId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE children SET archived_at = ? WHERE id = ?', Date.now(), childId);
}

export async function deleteChildPermanently(childId: string): Promise<void> {
  const db = await getDatabase();
  // El resto de tablas cuelga de `children` con ON DELETE CASCADE.
  await db.runAsync('DELETE FROM children WHERE id = ?', childId);
}

export async function getSettings(childId: string): Promise<ChildSettings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SettingsRow>(
    `SELECT child_id, session_size, focus_pillars, allow_open_response, reward_policy
     FROM child_settings WHERE child_id = ?`,
    childId,
  );

  if (!row) {
    return {
      childId,
      sessionSize: 5,
      focusPillars: [],
      allowOpenResponse: true,
      rewardPolicy: DEFAULT_REWARD_POLICY,
    };
  }

  return {
    childId: row.child_id,
    sessionSize: clampSessionSize(row.session_size),
    focusPillars: parsePillars(row.focus_pillars),
    allowOpenResponse: row.allow_open_response === 1,
    rewardPolicy: parseRewardPolicy(row.reward_policy),
  };
}

export async function updateSettings(
  childId: string,
  patch: Partial<Omit<ChildSettings, 'childId'>>,
): Promise<void> {
  const current = await getSettings(childId);
  const next: ChildSettings = {
    ...current,
    ...patch,
    childId,
    sessionSize: clampSessionSize(patch.sessionSize ?? current.sessionSize),
  };

  const db = await getDatabase();
  await db.runAsync(
    `UPDATE child_settings
     SET session_size = ?, focus_pillars = ?, allow_open_response = ?, reward_policy = ?, updated_at = ?
     WHERE child_id = ?`,
    next.sessionSize,
    JSON.stringify(next.focusPillars),
    next.allowOpenResponse ? 1 : 0,
    JSON.stringify(next.rewardPolicy),
    Date.now(),
    childId,
  );
}

function toChild(row: ChildRow): Child {
  return {
    id: row.id,
    alias: row.alias,
    avatar: row.avatar,
    // La restricción CHECK del esquema ya lo garantiza; la comprobación cubre
    // el caso de una base manipulada a mano.
    band: isAgeBand(row.band) ? row.band : '9-12',
    createdAt: row.created_at,
  };
}

const clampSessionSize = (value: number): number =>
  Math.min(MAX_SESSION_SIZE, Math.max(MIN_SESSION_SIZE, Math.round(value)));

/**
 * Los campos JSON se parsean a la defensiva: una base editada a mano o una
 * versión anterior con otro formato no debe tumbar el arranque de la app.
 */
function parsePillars(raw: string): Pillar[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is Pillar => typeof v === 'string' && isPillar(v)) : [];
  } catch {
    return [];
  }
}

function parseRewardPolicy(raw: string): RewardPolicy {
  try {
    const parsed = JSON.parse(raw) as Partial<RewardPolicy>;
    // Se fusiona sobre los valores por omisión: si una versión futura añade un
    // campo, los perfiles existentes lo reciben en lugar de quedar con `undefined`.
    return { ...DEFAULT_REWARD_POLICY, ...parsed };
  } catch {
    return DEFAULT_REWARD_POLICY;
  }
}
