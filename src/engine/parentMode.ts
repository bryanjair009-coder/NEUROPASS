/**
 * Modo adulto: pausa del tiempo de pantalla del menor.
 *
 * El caso real que resuelve: en la mayoría de las familias el teléfono no es
 * del menor, es del adulto que se lo presta. Cuando el adulto lo recupera para
 * usarlo, dos cosas están mal en el modelo básico:
 *
 *  1. El tiempo ganado se consume igual, porque los permisos guardan un
 *     vencimiento absoluto. El menor pierde minutos que nunca disfrutó.
 *  2. La app bloquea las aplicaciones restringidas y pide resolver retos, al
 *     adulto, en su propio teléfono.
 *
 * La pausa arregla ambas: congela el tiempo y suspende el bloqueo.
 *
 * ## Cómo se congela el tiempo
 *
 * No se guarda "cuánto le queda". Se **desplaza el vencimiento** de los
 * permisos vigentes, que es una sola operación y deja la base coherente sin
 * estados intermedios que interpretar.
 *
 * Cuando la pausa tiene un límite (`pausedUntil`), el desplazamiento se aplica
 * **al empezar**, por toda la duración prevista. Así, si nadie vuelve a abrir
 * la app, al vencer la pausa el tiempo restante ya es correcto sin que haga
 * falta que nada se ejecute. Si el adulto termina antes, se devuelve la parte
 * de pausa no usada.
 *
 * Cuando la pausa es indefinida no hay nada que prever, así que el
 * desplazamiento se aplica al terminar, por el tiempo realmente transcurrido.
 *
 * Todo el archivo es aritmética pura y sin dependencias: es lo que permite
 * probar el caso que importa —que el menor no pierde ni gana un segundo— sin
 * un dispositivo.
 */

export interface ParentPause {
  /** Instante en que el adulto tomó el teléfono. */
  readonly pausedAt: number;
  /**
   * Instante en que la pausa se levanta sola, o `null` si es indefinida.
   *
   * Una pausa sin límite que se olvida deja al menor sin control por tiempo
   * indefinido, así que la interfaz ofrece un límite por omisión; el «sin
   * límite» existe porque hay motivos legítimos (un viaje largo) y esconderlo
   * llevaría a desactivar la supervisión entera, que es peor.
   */
  readonly pausedUntil: number | null;
}

/**
 * Desplazamiento que se aplica a los permisos **al iniciar** la pausa.
 *
 * Es la duración completa prevista en las pausas con límite, y cero en las
 * indefinidas, donde no hay nada que anticipar.
 */
export function shiftOnPause(pause: ParentPause): number {
  if (pause.pausedUntil === null) return 0;
  return Math.max(0, pause.pausedUntil - pause.pausedAt);
}

/**
 * Desplazamiento que se aplica **al terminar** la pausa.
 *
 * En una pausa con límite ya se adelantó la duración completa, así que aquí se
 * devuelve lo que no se usó, con signo negativo. Terminar exactamente al
 * vencimiento —o después— no devuelve nada, porque no sobró pausa.
 *
 * En una indefinida se suma el tiempo realmente transcurrido.
 */
export function shiftOnResume(pause: ParentPause, now: number): number {
  if (pause.pausedUntil === null) {
    return Math.max(0, now - pause.pausedAt);
  }

  // La negación se aplica solo cuando hay algo que devolver: negar un cero da
  // `-0`, que es aritméticamente idéntico pero se cuela en comparaciones
  // estrictas y en cualquier registro que lo imprima.
  const sinUsar = Math.max(0, pause.pausedUntil - Math.max(now, pause.pausedAt));
  return sinUsar === 0 ? 0 : -sinUsar;
}

/** Si la pausa sigue conteniendo al instante indicado. */
export function isPauseActive(pause: ParentPause | null, now: number): boolean {
  if (!pause) return false;
  return pause.pausedUntil === null || now < pause.pausedUntil;
}

/**
 * Minutos que le quedan al menor mientras la pausa está en curso.
 *
 * Durante una pausa con límite el vencimiento ya se adelantó, así que el
 * restante se mide contra el momento en que la pausa terminará y no contra
 * ahora: es lo que el menor recuperará al volver a tener el teléfono.
 */
export function frozenRemainingMs(
  pause: ParentPause,
  unlockedUntil: number | null,
  now: number,
): number {
  if (unlockedUntil === null) return 0;
  const reanudaEn = pause.pausedUntil ?? Math.max(now, pause.pausedAt);
  return Math.max(0, unlockedUntil - reanudaEn);
}

/** Opciones de duración que ofrece la interfaz, en minutos. `null` es sin límite. */
export const PAUSE_DURATIONS: readonly (number | null)[] = [15, 30, 60, 120, null];

export const DEFAULT_PAUSE_MINUTES = 30;
