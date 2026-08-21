import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import type { AgeBand } from '@/domain/age';
import type { Attempt, Exercise, ExerciseResponse } from '@/domain/exercise';
import type { Pillar } from '@/domain/pillar';
import { grade } from '@/engine/grading';
import { planSession, type SessionPlan } from '@/engine/session';
import type { MasteryState } from '@/engine/mastery';

/**
 * Máquina de estados de una sesión de retos.
 *
 * Vive en un reducer y no en un montón de `useState` porque tiene fases con
 * transiciones ilegales que conviene hacer imposibles: no se puede responder
 * durante la fase de memorización, no se puede avanzar sin haber calificado, y
 * un reto ya respondido no admite una segunda respuesta. Con estados sueltos
 * esas reglas acaban repartidas por los manejadores de la vista y se rompen.
 *
 *   preparando → estudiando ⇄ respondiendo → revisando → (siguiente | terminada)
 *
 * La fase `estudiando` solo existe para los retos de memoria: es el intervalo
 * en el que se muestra la secuencia y todavía no hay pregunta.
 */

export type SessionPhase = 'preparando' | 'estudiando' | 'respondiendo' | 'revisando' | 'terminada';

interface SessionState {
  phase: SessionPhase;
  plan: SessionPlan | null;
  index: number;
  attempts: Attempt[];
  /** Respuesta calificada del reto actual; solo existe en la fase `revisando`. */
  lastAttempt: Attempt | null;
  usedHint: boolean;
  hintVisible: boolean;
  /** Segundos restantes, o `null` si el reto no tiene cronómetro. */
  secondsLeft: number | null;
  startedAt: number;
}

type SessionAction =
  | { type: 'plan_listo'; plan: SessionPlan }
  | { type: 'empezar_reto'; now: number }
  | { type: 'fin_estudio'; now: number }
  | { type: 'pedir_pista' }
  | { type: 'tic' }
  | { type: 'responder'; attempt: Attempt }
  | { type: 'siguiente'; now: number };

const INITIAL: SessionState = {
  phase: 'preparando',
  plan: null,
  index: 0,
  attempts: [],
  lastAttempt: null,
  usedHint: false,
  hintVisible: false,
  secondsLeft: null,
  startedAt: 0,
};

function reducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'plan_listo':
      return { ...INITIAL, plan: action.plan, phase: 'preparando' };

    case 'empezar_reto': {
      const exercise = state.plan?.exercises[state.index];
      if (!exercise) return { ...state, phase: 'terminada' };

      const needsStudy = exercise.prompt.kind === 'sequence_recall';
      return {
        ...state,
        phase: needsStudy ? 'estudiando' : 'respondiendo',
        usedHint: false,
        hintVisible: false,
        lastAttempt: null,
        startedAt: action.now,
        // El cronómetro no corre durante la memorización: penalizaría el
        // tiempo que el reto obliga a esperar.
        secondsLeft: needsStudy ? null : exercise.timeLimitSec,
      };
    }

    case 'fin_estudio': {
      const exercise = state.plan?.exercises[state.index];
      if (!exercise || state.phase !== 'estudiando') return state;
      return {
        ...state,
        phase: 'respondiendo',
        startedAt: action.now,
        secondsLeft: exercise.timeLimitSec,
      };
    }

    case 'pedir_pista':
      return { ...state, usedHint: true, hintVisible: true };

    case 'tic': {
      if (state.phase !== 'respondiendo' || state.secondsLeft === null) return state;
      return { ...state, secondsLeft: Math.max(0, state.secondsLeft - 1) };
    }

    case 'responder': {
      // Solo se acepta una respuesta por reto: sin esta guarda, un doble toque
      // registraría dos intentos y desajustaría el modelo de maestría.
      if (state.phase !== 'respondiendo') return state;
      return {
        ...state,
        phase: 'revisando',
        lastAttempt: action.attempt,
        attempts: [...state.attempts, action.attempt],
        secondsLeft: null,
      };
    }

    case 'siguiente': {
      const nextIndex = state.index + 1;
      const nextExercise = state.plan?.exercises[nextIndex];
      if (!nextExercise) return { ...state, phase: 'terminada', index: nextIndex };

      const needsStudy = nextExercise.prompt.kind === 'sequence_recall';
      return {
        ...state,
        index: nextIndex,
        phase: needsStudy ? 'estudiando' : 'respondiendo',
        lastAttempt: null,
        usedHint: false,
        hintVisible: false,
        startedAt: action.now,
        secondsLeft: needsStudy ? null : nextExercise.timeLimitSec,
      };
    }
  }
}

export interface UseSessionInput {
  readonly band: AgeBand;
  readonly seed: string;
  readonly size: number;
  readonly mastery: Record<Pillar, MasteryState>;
  readonly focusPillars: readonly Pillar[];
  readonly recentFingerprints: readonly string[];
  readonly allowOpenResponse: boolean;
}

export interface UseSessionResult {
  readonly phase: SessionPhase;
  readonly exercise: Exercise | null;
  readonly index: number;
  readonly total: number;
  readonly attempts: readonly Attempt[];
  readonly lastAttempt: Attempt | null;
  readonly secondsLeft: number | null;
  readonly hintVisible: boolean;
  readonly usedHint: boolean;
  readonly canRequestHint: boolean;

  finishStudy(): void;
  requestHint(): void;
  submit(response: ExerciseResponse): void;
  next(): void;
}

export function useSession(input: UseSessionInput): UseSessionResult {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  // El plan se calcula una sola vez por semilla. Recalcularlo en cada
  // renderizado cambiaría los retos bajo los pies del menor.
  const plan = useMemo(
    () =>
      planSession({
        band: input.band,
        seed: input.seed,
        size: input.size,
        mastery: input.mastery,
        recentFingerprints: input.recentFingerprints,
        allowOpenResponse: input.allowOpenResponse,
        // Una lista vacía significa "los cinco pilares"; se omite la clave en
        // lugar de pasar `undefined`, que con `exactOptionalPropertyTypes` no
        // es lo mismo que no pasarla.
        ...(input.focusPillars.length > 0 ? { focusPillars: input.focusPillars } : {}),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input.seed],
  );

  useEffect(() => {
    dispatch({ type: 'plan_listo', plan });
    dispatch({ type: 'empezar_reto', now: Date.now() });
  }, [plan]);

  const exercise = state.plan?.exercises[state.index] ?? null;

  const submitImpl = useCallback(
    (response: ExerciseResponse) => {
      if (!exercise) return;
      dispatch({
        type: 'responder',
        attempt: {
          exercise,
          response,
          grade: grade(exercise, response),
          elapsedMs: Date.now() - state.startedAt,
          usedHint: state.usedHint,
        },
      });
    },
    [exercise, state.startedAt, state.usedHint],
  );

  // El cronómetro necesita poder enviar una omisión al llegar a cero, pero no
  // debe volver a programarse cada vez que `submit` cambia de identidad. Se
  // guarda en un ref, y la asignación va en un efecto porque escribir en un ref
  // durante el render es un efecto secundario encubierto.
  const submitRef = useRef<(response: ExerciseResponse) => void>(() => undefined);

  useEffect(() => {
    submitRef.current = submitImpl;
  });

  useEffect(() => {
    if (state.phase !== 'respondiendo' || state.secondsLeft === null) return undefined;

    if (state.secondsLeft === 0) {
      submitRef.current({ kind: 'skipped' });
      return undefined;
    }

    const timer = setTimeout(() => dispatch({ type: 'tic' }), 1000);
    return () => clearTimeout(timer);
  }, [state.phase, state.secondsLeft]);

  // Fase de memorización: se cierra sola cuando pasa `studyMs`.
  useEffect(() => {
    if (state.phase !== 'estudiando' || !exercise) return undefined;
    if (exercise.prompt.kind !== 'sequence_recall') return undefined;

    const timer = setTimeout(
      () => dispatch({ type: 'fin_estudio', now: Date.now() }),
      exercise.prompt.studyMs,
    );
    return () => clearTimeout(timer);
  }, [state.phase, exercise]);


  return {
    phase: state.phase,
    exercise,
    index: state.index,
    total: plan.exercises.length,
    attempts: state.attempts,
    lastAttempt: state.lastAttempt,
    secondsLeft: state.secondsLeft,
    hintVisible: state.hintVisible,
    usedHint: state.usedHint,
    canRequestHint:
      state.phase === 'respondiendo' && !state.usedHint && Boolean(exercise?.prompt.hint),

    finishStudy: () => dispatch({ type: 'fin_estudio', now: Date.now() }),
    requestHint: () => dispatch({ type: 'pedir_pista' }),
    submit: submitImpl,
    next: () => dispatch({ type: 'siguiente', now: Date.now() }),
  };
}
