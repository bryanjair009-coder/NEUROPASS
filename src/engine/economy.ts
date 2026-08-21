import type { Attempt } from '@/domain/exercise';

/**
 * Economía de tiempo ganado.
 *
 * Convierte el esfuerzo cognitivo en minutos de ocio. Es la pieza que puede
 * arruinar el producto entero si se calibra mal, en cualquiera de las dos
 * direcciones: si dar demasiado, el límite deja de existir; si da demasiado
 * poco, el menor abandona y el tutor desinstala la app.
 *
 * Tres reglas la gobiernan:
 *
 *  1. **Solo el acierto paga, pero el error no cobra.** Fallar da cero minutos,
 *     nunca resta. Restar convertiría el aprendizaje en un castigo y empujaría
 *     al menor a evitar los retos difíciles, que es justo lo contrario de lo
 *     que se busca.
 *  2. **La dificultad paga más.** Sin esto, la estrategia óptima sería
 *     responder mil retos triviales, y el modelo de maestría no serviría de nada.
 *  3. **Rendimientos decrecientes.** A partir de cierta cantidad de sesiones
 *     diarias, cada una vale progresivamente menos, y existe además un tope
 *     duro que fija el tutor. NEUROpass regula tiempo de pantalla: sin tope,
 *     un menor persistente podría desbloquear el día completo.
 */

export interface RewardPolicy {
  /** Minutos base por respuesta correcta en dificultad 1. */
  readonly minutesPerCorrect: number;
  /** Minutos extra por cada nivel de dificultad por encima de 1. */
  readonly difficultyBonusMinutes: number;
  /** Premio por completar la sesión sin errores. */
  readonly perfectBonusMinutes: number;
  /** Multiplicador aplicado a un acierto en el que se usó la pista. */
  readonly hintFactor: number;
  /** Tope duro de minutos ganables al día. */
  readonly dailyCapMinutes: number;
  /** Espera obligatoria entre sesiones, para que no sea una máquina de fichas. */
  readonly sessionCooldownMinutes: number;
  /** Sesiones diarias que pagan la tarifa completa. */
  readonly fullRateSessionsPerDay: number;
  /** Factor que se aplica por cada sesión más allá del límite anterior. */
  readonly diminishingFactor: number;
  /**
   * Hora local en la que empieza un nuevo día contable (0–23). Se usa 4 y no 0
   * para que la actividad de la madrugada cuente al día anterior, que es como
   * lo entiende una familia.
   */
  readonly dayResetHour: number;
}

export const DEFAULT_REWARD_POLICY: RewardPolicy = {
  minutesPerCorrect: 3,
  difficultyBonusMinutes: 1,
  perfectBonusMinutes: 5,
  hintFactor: 0.6,
  dailyCapMinutes: 90,
  sessionCooldownMinutes: 10,
  fullRateSessionsPerDay: 3,
  diminishingFactor: 0.6,
  dayResetHour: 4,
};

/** Acumulado del día contable en curso. */
export interface DailyLedger {
  /** Clave del día contable, `YYYY-MM-DD`. */
  readonly dayKey: string;
  readonly earnedMinutes: number;
  readonly sessionsCompleted: number;
  /** Fin de la última sesión, para aplicar el enfriamiento. */
  readonly lastSessionEndedAt: number;
}

export interface RewardLine {
  readonly label: string;
  readonly minutes: number;
}

export interface RewardBreakdown {
  /** Minutos efectivamente otorgados, ya con tope y decaimiento aplicados. */
  readonly grantedMinutes: number;
  /** Minutos antes de decaimiento y tope; se muestra al tutor, no al menor. */
  readonly rawMinutes: number;
  readonly lines: readonly RewardLine[];
  readonly diminishingApplied: number;
  readonly cappedByDailyLimit: boolean;
  readonly correctCount: number;
  readonly gradedCount: number;
}

/** Clave del día contable de un instante, según la hora de corte de la política. */
export function dayKeyOf(timestamp: number, resetHour: number): string {
  const date = new Date(timestamp);
  // Restar la hora de corte desplaza la frontera del día: a las 02:00 con corte
  // en 4 se obtiene la fecha de ayer, que es la que corresponde.
  date.setHours(date.getHours() - resetHour);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function emptyLedger(timestamp: number, policy: RewardPolicy): DailyLedger {
  return {
    dayKey: dayKeyOf(timestamp, policy.dayResetHour),
    earnedMinutes: 0,
    sessionsCompleted: 0,
    lastSessionEndedAt: 0,
  };
}

/** Devuelve el libro del día en curso, reiniciándolo si cambió el día contable. */
export function rolledOver(ledger: DailyLedger, timestamp: number, policy: RewardPolicy): DailyLedger {
  const today = dayKeyOf(timestamp, policy.dayResetHour);
  return ledger.dayKey === today ? ledger : emptyLedger(timestamp, policy);
}

export type SessionGate =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: 'cooldown'; readonly waitMs: number }
  | { readonly allowed: false; readonly reason: 'daily_cap' };

/**
 * Decide si se puede iniciar una sesión ahora.
 *
 * El enfriamiento se mide contra el fin de la última sesión. Si el reloj del
 * sistema retrocede —el menor cambia la fecha— la resta sale negativa y se
 * trata como enfriamiento completo pendiente, no como permiso.
 */
export function canStartSession(
  ledger: DailyLedger,
  policy: RewardPolicy,
  now: number,
): SessionGate {
  const today = rolledOver(ledger, now, policy);

  if (today.earnedMinutes >= policy.dailyCapMinutes) {
    return { allowed: false, reason: 'daily_cap' };
  }

  if (today.lastSessionEndedAt === 0) return { allowed: true };

  const cooldownMs = policy.sessionCooldownMinutes * 60_000;
  const elapsed = now - today.lastSessionEndedAt;

  if (elapsed < 0) return { allowed: false, reason: 'cooldown', waitMs: cooldownMs };
  if (elapsed < cooldownMs) return { allowed: false, reason: 'cooldown', waitMs: cooldownMs - elapsed };

  return { allowed: true };
}

/**
 * Calcula la recompensa de una sesión terminada.
 *
 * No muta el libro diario: devuelve solo el desglose. Aplicarlo es
 * responsabilidad de `applyReward`, que sí produce el libro nuevo.
 */
export function computeReward(
  attempts: readonly Attempt[],
  policy: RewardPolicy,
  ledger: DailyLedger,
  now: number,
): RewardBreakdown {
  const today = rolledOver(ledger, now, policy);

  // Los retos abiertos se aceptan por esfuerzo y pagan, pero no cuentan para
  // la racha perfecta: no hay acierto que juzgar.
  const graded = attempts.filter((attempt) => attempt.exercise.prompt.kind !== 'open_response');
  const rewarded = attempts.filter(
    (attempt) => attempt.grade.outcome === 'correct' || attempt.grade.outcome === 'accepted',
  );

  const lines: RewardLine[] = [];
  let raw = 0;

  const baseMinutes = rewarded.reduce((sum, attempt) => {
    const value =
      policy.minutesPerCorrect + (attempt.exercise.difficulty - 1) * policy.difficultyBonusMinutes;
    return sum + (attempt.usedHint ? value * policy.hintFactor : value);
  }, 0);

  if (baseMinutes > 0) {
    raw += baseMinutes;
    lines.push({ label: `${rewarded.length} retos resueltos`, minutes: round1(baseMinutes) });
  }

  const perfect = graded.length > 0 && graded.every((attempt) => attempt.grade.outcome === 'correct');
  if (perfect) {
    raw += policy.perfectBonusMinutes;
    lines.push({ label: 'Sesión perfecta', minutes: policy.perfectBonusMinutes });
  }

  // Decaimiento por número de sesiones ya completadas hoy.
  const extraSessions = Math.max(0, today.sessionsCompleted - policy.fullRateSessionsPerDay + 1);
  const diminishing = policy.diminishingFactor ** extraSessions;
  const afterDiminishing = raw * diminishing;

  if (extraSessions > 0 && raw > 0) {
    lines.push({
      label: `Ajuste por ${today.sessionsCompleted + 1}ª sesión de hoy`,
      minutes: round1(afterDiminishing - raw),
    });
  }

  const remaining = Math.max(0, policy.dailyCapMinutes - today.earnedMinutes);
  const granted = Math.min(Math.round(afterDiminishing), remaining);
  const cappedByDailyLimit = Math.round(afterDiminishing) > remaining;

  if (cappedByDailyLimit) {
    lines.push({ label: 'Límite diario alcanzado', minutes: granted - Math.round(afterDiminishing) });
  }

  return {
    grantedMinutes: granted,
    rawMinutes: round1(raw),
    lines,
    diminishingApplied: diminishing,
    cappedByDailyLimit,
    correctCount: rewarded.length,
    gradedCount: graded.length,
  };
}

/** Asienta una recompensa en el libro del día. */
export function applyReward(
  ledger: DailyLedger,
  breakdown: RewardBreakdown,
  policy: RewardPolicy,
  now: number,
): DailyLedger {
  const today = rolledOver(ledger, now, policy);
  return {
    dayKey: today.dayKey,
    earnedMinutes: today.earnedMinutes + breakdown.grantedMinutes,
    sessionsCompleted: today.sessionsCompleted + 1,
    lastSessionEndedAt: now,
  };
}

/**
 * Fin de la ventana de juego tras conceder `minutes`.
 *
 * Si ya hay una ventana abierta, la nueva concesión se encadena a partir de su
 * fin; si no, empieza ahora. Encadenar en vez de solapar es lo que hace que
 * ganar 15 minutos cuando quedan 20 sirva de algo: solapando, el máximo de las
 * caducidades seguiría siendo el de la ventana anterior y los minutos recién
 * ganados desaparecerían.
 *
 * Es una función pura y vive aquí, junto al resto de reglas de la economía,
 * para poder verificarla sin base de datos.
 */
export function extendUnlockWindow(
  currentEnd: number | null,
  now: number,
  minutes: number,
): number {
  const start = currentEnd !== null && currentEnd > now ? currentEnd : now;
  return start + Math.max(0, minutes) * 60_000;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;
