/**
 * Migraciones del esquema local.
 *
 * Se usa SQL escrito a mano en vez de un ORM con generación de código porque
 * el esquema es pequeño, estable y crítico: conviene poder leer exactamente qué
 * columnas existen y qué se guarda de un menor sin atravesar una capa de
 * abstracción. Cada migración es un salto de `PRAGMA user_version`, aplicado
 * dentro de una transacción por el runner de `db.ts`.
 *
 * REGLA DE PRIVACIDAD, aplicada en el propio esquema:
 *
 *  - No existe columna alguna para fecha de nacimiento, correo, teléfono,
 *    escuela, ubicación ni identificador de dispositivo. Del menor solo se
 *    guarda un alias que el tutor escribe, un emoji y el rango de edad.
 *  - De cada intento se guarda el *resultado* (pilar, dificultad, acierto,
 *    tiempo), nunca el enunciado ni la respuesta elegida. Con la huella y la
 *    semilla se puede reconstruir el reto si hace falta, sin duplicar contenido.
 *  - Las respuestas escritas —lo único que un menor redacta con sus palabras—
 *    viven en su propia tabla, para poder borrarlas en bloque sin tocar el
 *    progreso y para que sea evidente dónde están.
 */

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'esquema_inicial',
    statements: [
      `CREATE TABLE children (
        id           TEXT PRIMARY KEY NOT NULL,
        alias        TEXT NOT NULL,
        avatar       TEXT NOT NULL DEFAULT '🙂',
        band         TEXT NOT NULL CHECK (band IN ('6-8', '9-12', '13-16')),
        created_at   INTEGER NOT NULL,
        archived_at  INTEGER
      )`,

      `CREATE TABLE child_settings (
        child_id            TEXT PRIMARY KEY NOT NULL REFERENCES children(id) ON DELETE CASCADE,
        session_size        INTEGER NOT NULL DEFAULT 5,
        focus_pillars       TEXT NOT NULL DEFAULT '[]',
        allow_open_response INTEGER NOT NULL DEFAULT 1,
        reward_policy       TEXT NOT NULL,
        updated_at          INTEGER NOT NULL
      )`,

      `CREATE TABLE mastery (
        child_id   TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
        pillar     TEXT NOT NULL,
        rating     REAL NOT NULL,
        attempts   INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (child_id, pillar)
      )`,

      `CREATE TABLE sessions (
        id              TEXT PRIMARY KEY NOT NULL,
        child_id        TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
        seed            TEXT NOT NULL,
        started_at      INTEGER NOT NULL,
        ended_at        INTEGER,
        granted_minutes INTEGER NOT NULL DEFAULT 0,
        correct_count   INTEGER NOT NULL DEFAULT 0,
        total_count     INTEGER NOT NULL DEFAULT 0
      )`,

      `CREATE INDEX idx_sessions_child_time ON sessions (child_id, started_at DESC)`,

      // Sin enunciado ni respuesta elegida: solo el resultado y la huella, que
      // es lo que necesitan el modelo de maestría y el antirrepetición.
      `CREATE TABLE attempts (
        id          TEXT PRIMARY KEY NOT NULL,
        session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        child_id    TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
        source_id   TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        pillar      TEXT NOT NULL,
        difficulty  INTEGER NOT NULL,
        outcome     TEXT NOT NULL,
        elapsed_ms  INTEGER NOT NULL,
        used_hint   INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL
      )`,

      `CREATE INDEX idx_attempts_child_fingerprint ON attempts (child_id, created_at DESC)`,
      `CREATE INDEX idx_attempts_child_pillar ON attempts (child_id, pillar, created_at DESC)`,

      // Tabla aparte y explícita: es el único texto libre que escribe el menor.
      `CREATE TABLE open_responses (
        id         TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        child_id   TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
        prompt     TEXT NOT NULL,
        body       TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,

      `CREATE INDEX idx_open_responses_child ON open_responses (child_id, created_at DESC)`,

      `CREATE TABLE daily_ledger (
        child_id             TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
        day_key              TEXT NOT NULL,
        earned_minutes       INTEGER NOT NULL DEFAULT 0,
        sessions_completed   INTEGER NOT NULL DEFAULT 0,
        last_session_ended_at INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (child_id, day_key)
      )`,

      // Un permiso concedido: minutos desbloqueados con inicio y caducidad.
      `CREATE TABLE time_grants (
        id           TEXT PRIMARY KEY NOT NULL,
        child_id     TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
        minutes      INTEGER NOT NULL,
        source       TEXT NOT NULL CHECK (source IN ('session', 'parent')),
        granted_at   INTEGER NOT NULL,
        expires_at   INTEGER NOT NULL,
        revoked_at   INTEGER
      )`,

      `CREATE INDEX idx_grants_child_active ON time_grants (child_id, expires_at DESC)`,

      `CREATE TABLE blocked_apps (
        child_id     TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
        package_name TEXT NOT NULL,
        app_label    TEXT NOT NULL,
        added_at     INTEGER NOT NULL,
        PRIMARY KEY (child_id, package_name)
      )`,

      // Ventanas en las que el ocio está bloqueado pase lo que pase (escuela,
      // noche). Minutos desde la medianoche local; weekday 0 = domingo.
      `CREATE TABLE schedules (
        id           TEXT PRIMARY KEY NOT NULL,
        child_id     TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
        label        TEXT NOT NULL,
        weekday_mask INTEGER NOT NULL,
        start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
        end_minute   INTEGER NOT NULL CHECK (end_minute BETWEEN 0 AND 1440),
        enabled      INTEGER NOT NULL DEFAULT 1
      )`,

      `CREATE INDEX idx_schedules_child ON schedules (child_id, enabled)`,

      // Bitácora de acciones del tutor: cambiar límites, conceder tiempo,
      // borrar datos. Permite que otro tutor entienda qué pasó y cuándo.
      `CREATE TABLE audit_log (
        id         TEXT PRIMARY KEY NOT NULL,
        child_id   TEXT,
        action     TEXT NOT NULL,
        detail     TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )`,

      `CREATE INDEX idx_audit_time ON audit_log (created_at DESC)`,
    ],
  },

  {
    version: 2,
    name: 'modo_adulto',
    statements: [
      // Modo adulto: el teléfono suele ser del padre o la madre, no del menor.
      // Mientras la pausa está activa no se bloquea nada y el tiempo ganado no
      // se consume.
      //
      // Una fila por menor, y su sola presencia significa "en pausa": no hace
      // falta una bandera aparte que pueda contradecir a la fila.
      `CREATE TABLE parent_mode (
        child_id     TEXT PRIMARY KEY NOT NULL REFERENCES children(id) ON DELETE CASCADE,
        paused_at    INTEGER NOT NULL,
        paused_until INTEGER
      )`,
    ],
  },
];

export const TARGET_SCHEMA_VERSION = MIGRATIONS.reduce(
  (max, migration) => Math.max(max, migration.version),
  0,
);
