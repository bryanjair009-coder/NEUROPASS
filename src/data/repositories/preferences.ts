import { getDatabase } from '@/data/db';

/**
 * Preferencias de la app, no del menor.
 *
 * Un almacén de clave y valor deliberadamente simple. Aquí van los ajustes que
 * no pertenecen a ningún perfil —el tema visual, por ahora— y que tampoco son
 * secretos: eso vive en el almacén seguro, junto al PIN.
 */

export async function getPreference(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_prefs WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setPreference(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO app_prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
