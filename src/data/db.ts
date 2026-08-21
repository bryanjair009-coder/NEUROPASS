import * as SQLite from 'expo-sqlite';

import { MIGRATIONS, TARGET_SCHEMA_VERSION } from './migrations';

/**
 * Acceso a la base local.
 *
 * SQLite es la fuente de verdad de NEUROpass. No hay copia en la nube del
 * progreso ni de las respuestas: si el tutor no exporta nada, nada sale del
 * dispositivo. Esa decisión es de cumplimiento (COPPA §312.8 pide minimizar la
 * retención) y también de producto: la app tiene que funcionar completa sin red.
 */

const DATABASE_NAME = 'neuropass.db';

let handle: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (handle) return handle;
  // Varias pantallas pueden pedir la base a la vez durante el arranque; se
  // comparte la misma promesa para no abrirla ni migrarla dos veces.
  opening ??= openAndMigrate();
  handle = await opening;
  return handle;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // WAL mejora la concurrencia lectura/escritura; las claves foráneas hay que
  // activarlas explícitamente en cada conexión, SQLite las trae apagadas.
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  if (current > TARGET_SCHEMA_VERSION) {
    throw new Error(
      `La base local está en la versión ${current}, más nueva que la que entiende esta ` +
        `instalación (${TARGET_SCHEMA_VERSION}). Actualiza la app en lugar de degradar el esquema.`,
    );
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;

    // Cada migración es atómica: o queda entera o no queda nada. Una migración
    // a medias dejaría la app en un estado que ningún arranque posterior sabría
    // reparar.
    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      // `PRAGMA user_version` no admite parámetros enlazados; el valor es un
      // entero literal del código, nunca entrada del usuario.
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

/** Cierra la conexión. Solo para tests y para el borrado total de datos. */
export async function closeDatabase(): Promise<void> {
  if (!handle) return;
  await handle.closeAsync();
  handle = null;
  opening = null;
}

/**
 * Borra todos los datos locales y vuelve a crear el esquema.
 * Es la implementación del "derecho al borrado": una sola llamada, sin residuos.
 */
export async function wipeAllData(): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    // Orden inverso a las dependencias; con `ON DELETE CASCADE` bastaría con
    // `children`, pero ser explícito evita depender de que el PRAGMA esté activo.
    for (const table of [
      'audit_log',
      'schedules',
      'blocked_apps',
      'time_grants',
      'daily_ledger',
      'open_responses',
      'attempts',
      'sessions',
      'mastery',
      'child_settings',
      'children',
    ]) {
      await db.execAsync(`DELETE FROM ${table}`);
    }
  });

  // VACUUM no puede correr dentro de una transacción, y hace falta para que el
  // archivo devuelva el espacio en vez de conservar las páginas borradas.
  await db.execAsync('VACUUM');
}
