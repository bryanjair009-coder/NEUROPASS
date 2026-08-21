/**
 * Bloqueo por intentos fallidos.
 *
 * Es la defensa principal del PIN del tutor, porque es la que actúa contra el
 * ataque que de verdad ocurre: un menor probando combinaciones a mano. Tres
 * propiedades hacen que funcione:
 *
 *  1. **Exponencial.** Cada fallo adicional duplica la espera. Probar el millón
 *     de PINs de 6 dígitos pasa a ser inviable en cualquier horizonte humano.
 *  2. **Persistente.** El estado vive en almacenamiento y no en memoria: cerrar
 *     la app o reiniciar el teléfono no reinicia el contador. Un bloqueo que se
 *     evade matando el proceso no es un bloqueo.
 *  3. **Monótona en el tiempo.** El desbloqueo se compara contra el reloj del
 *     sistema, que el menor puede atrasar. Por eso se guarda también el instante
 *     del último fallo: si el reloj retrocede, se considera manipulado y se
 *     mantiene el bloqueo (ver `evaluateLock`).
 *
 * Todo el módulo es puro: recibe `now` y devuelve estado nuevo. La persistencia
 * la hace quien lo llama.
 */

export interface LockoutState {
  readonly failedAttempts: number;
  /** Instante hasta el que el acceso está bloqueado; 0 si no lo está. */
  readonly lockedUntil: number;
  /** Instante del último fallo, para detectar manipulación del reloj. */
  readonly lastFailureAt: number;
}

export const INITIAL_LOCKOUT: LockoutState = {
  failedAttempts: 0,
  lockedUntil: 0,
  lastFailureAt: 0,
};

/** Fallos tolerados sin penalización: cubre el error de dedo legítimo. */
const FREE_ATTEMPTS = 3;
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 60 * 60 * 1000;

export interface LockStatus {
  readonly locked: boolean;
  readonly remainingMs: number;
  readonly failedAttempts: number;
  /** Intentos que quedan antes de que empiece la penalización. */
  readonly attemptsBeforeDelay: number;
}

export function evaluateLock(state: LockoutState, now: number): LockStatus {
  const base = {
    failedAttempts: state.failedAttempts,
    attemptsBeforeDelay: Math.max(0, FREE_ATTEMPTS - state.failedAttempts),
  };

  if (state.lockedUntil === 0) {
    return { locked: false, remainingMs: 0, ...base };
  }

  // Reloj atrasado respecto al último fallo registrado: se asume manipulación
  // y se mantiene el bloqueo completo en lugar de concederlo por adelantado.
  if (now < state.lastFailureAt) {
    return { locked: true, remainingMs: state.lockedUntil - state.lastFailureAt, ...base };
  }

  const remaining = state.lockedUntil - now;
  return remaining > 0
    ? { locked: true, remainingMs: remaining, ...base }
    : { locked: false, remainingMs: 0, ...base };
}

export function registerFailure(state: LockoutState, now: number): LockoutState {
  const failedAttempts = state.failedAttempts + 1;
  const penalized = failedAttempts - FREE_ATTEMPTS;

  if (penalized <= 0) {
    return { failedAttempts, lockedUntil: 0, lastFailureAt: now };
  }

  const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (penalized - 1));
  return { failedAttempts, lockedUntil: now + delay, lastFailureAt: now };
}

/** Un acierto limpia el historial por completo. */
export function registerSuccess(): LockoutState {
  return INITIAL_LOCKOUT;
}

/** Texto legible de la espera restante, para la pantalla de PIN. */
export function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;

  const minutes = Math.ceil(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
